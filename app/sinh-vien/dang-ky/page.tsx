
"use client";

import { useState } from "react";
import Link from "next/link";

export default function StudentRegisterPage() {
  const [hoTen, setHoTen] = useState("");
  const [mssv, setMssv] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    const studentEmail = email.trim().toLowerCase();

    if (!studentEmail.endsWith("@bmu.edu.vn")) {
      setError("Chỉ chấp nhận email có đuôi @bmu.edu.vn.");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/sinh-vien/dang-ky", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ho_ten: hoTen.trim(),
          mssv: mssv.trim().toUpperCase(),
          email: studentEmail,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Đăng ký không thành công.");
        return;
      }

      setMessage(result.message);
      setHoTen("");
      setMssv("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={mainStyle}>
      <form onSubmit={handleRegister} style={formStyle}>
        {/* Logo */}
        <div style={headerStyle}>
          <img
            src="/logo-doan-hoi-bmu.png"
            alt="Logo Đoàn - Hội BMU"
            style={{
              width: 320,
              height: "auto",
              maxHeight: 160,
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>

        <div style={{ marginTop: 8, marginBottom: 28, textAlign: "center" }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1e3a8a",
              lineHeight: 1.4,
              margin: 0,
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            QUẢN LÝ HOẠT ĐỘNG BMU
            <br />
            Đăng ký
          </h2>
        </div>

        {/* Thông tin */}
        <label style={labelStyle}>Họ và tên</label>
        <input
          style={inputStyle}
          value={hoTen}
          onChange={(e) => setHoTen(e.target.value)}
          placeholder="Nhập họ và tên"
          autoComplete="name"
          required
        />

        <label style={labelStyle}>Mã số sinh viên</label>
        <input
          style={inputStyle}
          value={mssv}
          onChange={(e) => setMssv(e.target.value.toUpperCase())}
          placeholder="Nhập mã số sinh viên"
          required
        />

        <label style={labelStyle}>Email sinh viên BMU</label>
        <input
          style={inputStyle}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@bmu.edu.vn"
          autoComplete="email"
          required
        />

        <label style={labelStyle}>Mật khẩu</label>
        <input
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Ít nhất 8 ký tự"
          minLength={8}
          autoComplete="new-password"
          required
        />

        <label style={labelStyle}>Xác nhận mật khẩu</label>
        <input
          style={inputStyle}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
          required
        />

        {/* Thông báo */}
        {error && (
          <div style={errorStyle}>
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div style={successStyle}>
            ✓ {message}
          </div>
        )}

        {/* Nút đăng ký */}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Đang đăng ký..." : "Tạo tài khoản →"}
        </button>

        {/* Chuyển đăng nhập */}
        <p style={registerStyle}>
          Đã có tài khoản?{" "}
          <Link href="/sinh-vien/dang-nhap" style={linkStyle}>
            Đăng nhập ngay
          </Link>
        </p>
      </form>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at top left, #e0edff 0%, #f3f6fb 45%, #eef2f8 100%)",
  padding: 20,
};

const formStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "#ffffff",
  padding: 36,
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(23,71,131,0.12)",
  boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.8)",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 28,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 14,
  color: "#334155",
  marginTop: 18,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 14,
  border: "1px solid #dbe2ea",
  borderRadius: 11,
  boxSizing: "border-box",
  fontSize: 15,
  outline: "none",
  background: "#fbfdff",
  transition: "border 0.2s",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  padding: 12,
  borderRadius: 10,
  fontSize: 14,
  marginTop: 18,
};

const successStyle: React.CSSProperties = {
  background: "#f0fdf4",
  color: "#15803d",
  border: "1px solid #bbf7d0",
  padding: 12,
  borderRadius: 10,
  fontSize: 14,
  marginTop: 18,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 15,
  marginTop: 26,
  background: "linear-gradient(135deg, #174783, #2563a9)",
  color: "white",
  border: 0,
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(23,71,131,0.2)",
  transition: "all 0.2s ease",
};

const registerStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: 22,
  fontSize: 14,
  color: "#64748b",
};

const linkStyle: React.CSSProperties = {
  color: "#174783",
  fontWeight: 700,
  textDecoration: "none",
};
