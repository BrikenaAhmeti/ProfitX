import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/auth.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};

  if (!email.trim()) {
    errors.email = "Email-i është i detyrueshëm.";
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = "Shkruani një email të vlefshëm.";
  }

  if (!password) {
    errors.password = "Fjalëkalimi është i detyrueshëm.";
  }

  return errors;
}

// Vend-ruajtës për API-në reale (POST /api/auth/login).
// Nuk simulon hyrje të suksesshme: deri sa API-ja e Suelës të jetë gati,
// kthen gabim të qartë. Lidhja reale bëhet në Javën 1 (e enjte) ose në A3.
// eslint-disable-next-line no-unused-vars
async function submitLogin(credentials) {
  throw new Error("Lidhja me serverin nuk është gati ende.");
}

function Login() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await submitLogin({
        email: values.email.trim(),
        password: values.password,
      });
    } catch (error) {
      setFormError(error.message || "Hyrja dështoi. Provoni përsëri.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">ProfitX</h1>
        <p className="auth-subtitle">Hyni në llogarinë tuaj</p>

        {formError && (
          <div className="auth-alert" role="alert">
            {formError}
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="emri@shembull.com"
            value={values.email}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.email)}
            disabled={loading}
          />
          {fieldErrors.email && (
            <span className="auth-error">{fieldErrors.email}</span>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Fjalëkalimi</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Fjalëkalimi"
            value={values.password}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.password)}
            disabled={loading}
          />
          {fieldErrors.password && (
            <span className="auth-error">{fieldErrors.password}</span>
          )}
        </div>

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? "Duke hyrë..." : "Hyr"}
        </button>

        <p className="auth-footer">
          Nuk keni llogari? <Link to="/register">Regjistrohuni</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;