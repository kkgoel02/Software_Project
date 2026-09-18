// createReviewRequest, addThreadEntry (student/professor uploads new round),
// updateStatus (approve / request changes), getReviewsByRepo, getReviewById


const ReviewRequest = require("../models/reviewRequest.model");
const Repo = require("../models/repo.model");
const Version = require("../models/version.model");
const fileService = require("../services/file.service");
const asyncHandler = require("../utils/asyncHandler");

/** Access check: user must be the repo's owner or a collaborator */
const assertRepoAccess = (repo, userId) => {
  const isOwner = repo.owner.equals(userId);
  const isCollaborator = repo.collaborators.some((c) => c.user.equals(userId));
  return isOwner || isCollaborator;
};

/**
 * POST /api/reviews/:repoId
 * Opens a new review request. Only a student can open one, pointing at
 * a paper version they've already uploaded, addressed to a specific
 * professor who must already be a collaborator on the repo.
 * Body: { versionId, professorId, comment? }
 */
exports.createReviewRequest = asyncHandler(async (req, res) => {
  const { repoId } = req.params;
  const { versionId, professorId, comment } = req.body;

  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only a student can open a review request" });
  }

  const repo = await Repo.findById(repoId);
  if (!repo) return res.status(404).json({ message: "Repo not found" });
  if (!assertRepoAccess(repo, req.user._id)) {
    return res.status(403).json({ message: "You don't have access to this repo" });
  }

  const professorIsCollaborator = repo.collaborators.some((c) => c.user.equals(professorId));
  if (!professorIsCollaborator) {
    return res.status(400).json({ message: "That professor is not a collaborator on this repo" });
  }

  const version = await Version.findOne({ _id: versionId, repo: repoId });
  if (!version) {
    return res.status(404).json({ message: "Version not found in this repo" });
  }

  const reviewRequest = await ReviewRequest.create({
    repo: repoId,
    student: req.user._id,
    professor: professorId,
    status: "open",
    thread: [{ version: versionId, uploadedByRole: "student", comment }],
  });

  res.status(201).json({ reviewRequest });
});

/**
 * POST /api/reviews/:id/thread
 * Adds a new round to an existing review request's thread.
 * Accepts a direct file upload (multipart), stores it as a new Version
 * behind the scenes, and appends it to the thread.
 * Body (form-data): file, comment?
 */
exports.addThreadEntry = asyncHandler(async (req, res) => {
  const reviewRequest = await ReviewRequest.findById(req.params.id).populate("repo");
  if (!reviewRequest) return res.status(404).json({ message: "Review request not found" });

  const isStudent = reviewRequest.student.equals(req.user._id);
  const isProfessor = reviewRequest.professor.equals(req.user._id);
  if (!isStudent && !isProfessor) {
    return res.status(403).json({ message: "You're not part of this review request" });
  }

  if (reviewRequest.status !== "open") {
    return res.status(400).json({ message: "This review request is closed" });
  }

  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const fileId = await fileService.uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);

  const lastVersion = await Version.findOne({ repo: reviewRequest.repo._id, type: "paper" }).sort({ versionNumber: -1 });
  const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

  const version = await Version.create({
    repo: reviewRequest.repo._id,
    uploadedBy: req.user._id,
    type: "paper",
    versionNumber,
    fileId,
    fileName: req.file.originalname,
    notes: req.body.comment,
  });

  reviewRequest.thread.push({
    version: version._id,
    uploadedByRole: req.user.role,
    comment: req.body.comment,
  });

  // A new student upload after professor feedback re-opens the loop for review;
  // reset to "open" in case it was previously marked changes_requested
  reviewRequest.status = "open";
  await reviewRequest.save();

  res.status(201).json({ reviewRequest });
});

/**
 * PATCH /api/reviews/:id/status
 * Only the assigned professor can approve or request changes.
 * Body: { status: "approved" | "changes_requested" }
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "changes_requested"].includes(status)) {
    return res.status(400).json({ message: "Status must be approved or changes_requested" });
  }

  const reviewRequest = await ReviewRequest.findById(req.params.id);
  if (!reviewRequest) return res.status(404).json({ message: "Review request not found" });

  if (!reviewRequest.professor.equals(req.user._id)) {
    return res.status(403).json({ message: "Only the assigned professor can update status" });
  }

  reviewRequest.status = status;
  await reviewRequest.save();

  res.status(200).json({ reviewRequest });
});

/**
 * GET /api/reviews/repo/:repoId
 * Lists all review requests for a repo (any status), access-checked.
 */
exports.getReviewsByRepo = asyncHandler(async (req, res) => {
  const repo = await Repo.findById(req.params.repoId);
  if (!repo) return res.status(404).json({ message: "Repo not found" });
  if (!assertRepoAccess(repo, req.user._id)) {
    return res.status(403).json({ message: "You don't have access to this repo" });
  }

  const reviewRequests = await ReviewRequest.find({ repo: req.params.repoId })
    .populate("student", "name email")
    .populate("professor", "name email")
    .sort({ updatedAt: -1 });

  res.status(200).json({ reviewRequests });
});

/**
 * GET /api/reviews/:id
 * Full thread detail for one review request.
 */
exports.getReviewById = asyncHandler(async (req, res) => {
  const reviewRequest = await ReviewRequest.findById(req.params.id)
    .populate("student", "name email")
    .populate("professor", "name email")
    .populate("thread.version");

  if (!reviewRequest) return res.status(404).json({ message: "Review request not found" });

  const isStudent = reviewRequest.student._id.equals(req.user._id);
  const isProfessor = reviewRequest.professor._id.equals(req.user._id);
  if (!isStudent && !isProfessor) {
    return res.status(403).json({ message: "You're not part of this review request" });
  }

  res.status(200).json({ reviewRequest });
});
