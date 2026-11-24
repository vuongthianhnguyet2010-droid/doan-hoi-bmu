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
          mssv: mssv.trim(),
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
        <h1 style={{ color: "#174783", textAlign: "center" }}>
          ĐOÀN – HỘI BMU
        </h1>

        <h2 style={{ textAlign: "center" }}>
          Đăng ký tài khoản sinh viên
        </h2>

        <p style={{ color: "#64748b", textAlign: "center" }}>
          Đăng ký tài khoản để tham gia các chương trình
          Đoàn – Hội và nhận giấy chứng nhận.
        </p>

        <label style={labelStyle}>Họ và tên</label>
        <input
          style={inputStyle}
          value={hoTen}
          onChange={(e) => setHoTen(e.target.value)}
          placeholder="Nhập họ và tên"
          required
        />

        <label style={labelStyle}>Mã số sinh viên</label>
        <input
          style={inputStyle}
          value={mssv}
          onChange={(e) => setMssv(e.target.value)}
          placeholder="Nhập MSSV"
          required
        />

        <label style={labelStyle}>Email sinh viên BMU</label>
        <input
          style={inputStyle}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@bmu.edu.vn"
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
          required
        />

        <label style={labelStyle}>Xác nhận mật khẩu</label>
        <input
          style={inputStyle}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Nhập lại mật khẩu"
          required
        />

        {error && (
          <p style={{ color: "#dc2626", fontSize: 14 }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ color: "#15803d", fontSize: 14 }}>
            {message}
          </p>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Đang đăng ký..." : "Đăng ký tài khoản"}
        </button>

        <p style={{ textAlign: "center", marginTop: 20 }}>
          Đã có tài khoản?{" "}
          <Link href="/sinh-vien/dang-nhap" style={linkStyle}>
            Đăng nhập
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
  background: "#f3f6fb",
  padding: 20,
};

const formStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 440,
  background: "white",
  padding: 32,
  borderRadius: 18,
  boxShadow: "0 8px 35px #00000010",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginTop: 16,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 13,
  marginTop: 8,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 15,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  marginTop: 24,
  background: "#174783",
  color: "white",
  border: 0,
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};

const linkStyle: React.CSSProperties = {
  color: "#174783",
  fontWeight: 600,
  textDecoration: "none",
};
