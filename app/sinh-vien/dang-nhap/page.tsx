
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"student" | "admin">("student");
  const [mssv, setMssv] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "student") {
        const response = await fetch("/api/sinh-vien/dang-nhap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mssv: mssv.trim(),
            password,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.message || "Đăng nhập không thành công.");
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });

        if (sessionError) {
          setError("Không thể tạo phiên đăng nhập. Vui lòng thử lại.");
          return;
        }

        router.push("/sinh-vien");
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) {
          setError("Email hoặc mật khẩu không chính xác.");
          return;
        }

        router.push("/admin");
      }
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: "student" | "admin") {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  return (
    <main style={mainStyle}>
      <form onSubmit={handleLogin} style={formStyle}>
        {/* Logo / tiêu đề */}
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
{/* Tiêu đề */}
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
    Đăng nhập
  </h2>
</div>

        {/* Chuyển đổi đăng nhập */}
        <div style={tabContainerStyle}>
          <button
            type="button"
            onClick={() => switchMode("student")}
            style={{
              ...tabStyle,
              ...(mode === "student" ? activeTabStyle : {}),
            }}
          >
            Sinh viên
          </button>

          <button
            type="button"
            onClick={() => switchMode("admin")}
            style={{
              ...tabStyle,
              ...(mode === "admin" ? activeTabStyle : {}),
            }}
          >
            Quản trị viên
          </button>
        </div>

        {/* Form sinh viên */}
        {mode === "student" && (
          <>
            <label style={labelStyle}>Mã số sinh viên</label>
            <input
              style={inputStyle}
              value={mssv}
              onChange={(e) => setMssv(e.target.value)}
              placeholder="Nhập mã số sinh viên"
              required
            />
          </>
        )}

        {/* Form quản trị */}
        {mode === "admin" && (
          <>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email quản trị"
              required
            />
          </>
        )}

        <label style={labelStyle}>Mật khẩu</label>
        <input
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nhập mật khẩu"
          required
        />

        {error && (
          <div style={errorStyle}>
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...submitStyle,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? "Đang đăng nhập..."
            : mode === "student"
              ? "Đăng nhập sinh viên"
              : "Đăng nhập quản trị viên"}
        </button>

        {/* Đăng ký chỉ dành cho sinh viên */}
        {mode === "student" && (
          <p style={registerStyle}>
            Chưa có tài khoản?{" "}
            <Link href="/sinh-vien/dang-ky" style={linkStyle}>
              Đăng ký ngay
            </Link>
          </p>
        )}
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

const logoStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 20,
  background: "linear-gradient(135deg, #174783, #2563a9)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: 22,
  margin: "0 auto 16px",
  boxShadow: "0 8px 20px rgba(23,71,131,0.25)",
};

const brandStyle: React.CSSProperties = {
  color: "#174783",
  fontSize: 23,
  fontWeight: 800,
  margin: 0,
  letterSpacing: 0.5,
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 8,
};

const tabContainerStyle: React.CSSProperties = {
  display: "flex",
  padding: 5,
  borderRadius: 14,
  background: "#f1f5f9",
  gap: 5,
};

const tabStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "13px 8px",
  border: "none",
  borderRadius: 11,
  background: "transparent",
  color: "#64748b",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.25s ease",
};

const activeTabStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#174783",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const headingStyle: React.CSSProperties = {
  fontSize: 22,
  color: "#172b4d",
  marginBottom: 8,
  fontWeight: 750,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.6,
  marginBottom: 24,
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

const submitStyle: React.CSSProperties = {
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

const footerStyle: React.CSSProperties = {
  borderTop: "1px solid #edf2f7",
  marginTop: 28,
  paddingTop: 20,
  textAlign: "center",
  color: "#94a3b8",
  fontSize: 11,
  letterSpacing: 1,
};
