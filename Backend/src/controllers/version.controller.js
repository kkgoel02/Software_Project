// uploadVersion, getVersionsByRepo, getVersionFile (download), linkVersion (traceability)

const mongoose = require("mongoose");
const Version = require("../models/version.model");
const Repo = require("../models/repo.model");
const fileService = require("../services/file.service");
const asyncHandler = require("../utils/asyncHandler");

const VALID_TYPES = ["paper", "dataset", "experiment", "result"];

/** Shared access check: user must be the repo's owner or a collaborator */
const assertRepoAccess = (repo, userId) => {
  const isOwner = repo.owner.equals(userId);
  const isCollaborator = repo.collaborators.some((c) => c.user.equals(userId));
  return isOwner || isCollaborator;
};

/**
 * POST /api/versions/:repoId
 * Uploads a new file version into a repo. Expects multipart/form-data:
 * - file: the actual file (required)
 * - type: paper | dataset | experiment | result (required)
 * - notes: optional text
 * - linkedTo: optional, comma-separated Version ids for traceability
 * Version numbers increment per-type within a repo (paper v1, v2... independent of dataset v1, v2...).
 */
exports.uploadVersion = asyncHandler(async (req, res) => {
  const { repoId } = req.params;
  const { type, notes, linkedTo } = req.body;

  const repo = await Repo.findById(repoId);
  if (!repo) return res.status(404).json({ message: "Repo not found" });
  if (!assertRepoAccess(repo, req.user._id)) {
    return res.status(403).json({ message: "You don't have access to this repo" });
  }

  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: `Type must be one of: ${VALID_TYPES.join(", ")}` });
  }

  const fileId = await fileService.uploadBuffer(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  const lastVersion = await Version.findOne({ repo: repoId, type }).sort({ versionNumber: -1 });
  const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

  const version = await Version.create({
    repo: repoId,
    uploadedBy: req.user._id,
    type,
    versionNumber,
    fileId,
    fileName: req.file.originalname,
    notes,
    linkedTo: linkedTo ? linkedTo.split(",").map((id) => id.trim()) : [],
  });

  res.status(201).json({ version });
});

/**
 * GET /api/versions/:repoId
 * Returns every version in a repo, most recent first, with uploader info populated.
 */
exports.getVersionsByRepo = asyncHandler(async (req, res) => {
  const { repoId } = req.params;

  const repo = await Repo.findById(repoId);
  if (!repo) return res.status(404).json({ message: "Repo not found" });
  if (!assertRepoAccess(repo, req.user._id)) {
    return res.status(403).json({ message: "You don't have access to this repo" });
  }

  const versions = await Version.find({ repo: repoId })
    .populate("uploadedBy", "name email role")
    .sort({ createdAt: -1 });

  res.status(200).json({ versions });
});

/**
 * GET /api/versions/file/:fileId
 * Streams the actual file back for download/preview.
 * Access is checked via the Version document's parent repo.
 */
exports.getVersionFile = asyncHandler(async (req, res) => {
  const version = await Version.findOne({ fileId: req.params.fileId }).populate("repo");
  if (!version) return res.status(404).json({ message: "File not found" });

  if (!assertRepoAccess(version.repo, req.user._id)) {
    return res.status(403).json({ message: "You don't have access to this file" });
  }

  res.set("Content-Disposition", `inline; filename="${version.fileName}"`);

  const stream = fileService.downloadStream(version.fileId);
  stream.on("error", () => res.status(404).json({ message: "File data not found in storage" }));
  stream.pipe(res);
});

/**
 * PATCH /api/versions/:id/link
 * Adds traceability links from this version to other versions
 * (e.g. a result linked to the dataset/script that produced it).
 */
exports.linkVersion = asyncHandler(async (req, res) => {
  const { linkedTo } = req.body; // array of Version ids

  const version = await Version.findById(req.params.id).populate("repo");
  if (!version) return res.status(404).json({ message: "Version not found" });
  if (!assertRepoAccess(version.repo, req.user._id)) {
    return res.status(403).json({ message: "You don't have access to this version" });
  }

  version.linkedTo = linkedTo;
  await version.save();

  res.status(200).json({ version });
});