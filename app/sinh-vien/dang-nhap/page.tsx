
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function StudentLoginPage() {
  const router = useRouter();

  const [mssv, setMssv] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
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
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={mainStyle}>
      <form onSubmit={handleLogin} style={formStyle}>
        <h1 style={{ color: "#174783", textAlign: "center" }}>
          ĐOÀN – HỘI BMU
        </h1>

        <h2 style={{ textAlign: "center" }}>
          Đăng nhập sinh viên
        </h2>

        <p style={{ color: "#64748b", textAlign: "center" }}>
          Đăng nhập bằng mã số sinh viên và mật khẩu.
        </p>

        <label style={labelStyle}>Mã số sinh viên</label>
        <input
          style={inputStyle}
          value={mssv}
          onChange={(e) => setMssv(e.target.value)}
          placeholder="Nhập MSSV"
          required
        />

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
          <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <p style={{ textAlign: "center", marginTop: 20 }}>
          Chưa có tài khoản?{" "}
          <Link href="/sinh-vien/dang-ky" style={linkStyle}>
            Đăng ký ngay
          </Link>
        </p>
        <p style={{
  textAlign: "center",
  marginTop: 20,
  marginBottom: 0,
  color: "#64748b",
  fontSize: 14
}}>
  Bạn là quản trị viên?{" "}
  <a
    href="/admin/login"
    style={{
      color: "#174783",
      fontWeight: 600,
      textDecoration: "none"
    }}
  >
    Đăng nhập tại đây
  </a>
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
  marginTop: 18,
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
