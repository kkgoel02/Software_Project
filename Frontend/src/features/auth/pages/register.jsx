import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import "../auth.form.scss";

function Register() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="auth-eyebrow">ResearchFlow</p>
        <h1>Create your account</h1>

        {error && <div className="auth-error">{error}</div>}

        <label>
          Name
          <input type="text" name="name" value={form.name} onChange={handleChange} required autoFocus />
        </label>

        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </label>

        <label>
          Password
          <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={8} />
        </label>

        <fieldset className="auth-role">
          <legend>I am a</legend>
          <label className="role-option">
            <input type="radio" name="role" value="student" checked={form.role === "student"} onChange={handleChange} />
            Student
          </label>
          <label className="role-option">
            <input type="radio" name="role" value="professor" checked={form.role === "professor"} onChange={handleChange} />
            Professor
          </label>
        </fieldset>

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;