
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Email hoặc mật khẩu không chính xác.");
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#f3f6fb",
      padding: 20
    }}>
      <form onSubmit={handleLogin} style={{
        width: "100%",
        maxWidth: 420,
        background: "white",
        padding: 36,
        borderRadius: 18,
        boxShadow: "0 8px 35px #00000010"
      }}>
        <h1 style={{ color: "#123b70", marginBottom: 8 }}>
          ĐOÀN – HỘI BMU
        </h1>

        <h2 style={{ marginBottom: 8 }}>Đăng nhập quản trị</h2>
        <p style={{ color: "#64748b", marginBottom: 24 }}>
          Vui lòng đăng nhập để tiếp tục.
        </p>

        <label>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Nhập email"
          style={inputStyle}
        />

        <label>Mật khẩu</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nhập mật khẩu"
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%",
          padding: 14,
          background: "#174783",
          color: "white",
          border: 0,
          borderRadius: 10,
          fontWeight: 600,
          cursor: "pointer"
        }}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 13,
  marginTop: 8,
  marginBottom: 20,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxSizing: "border-box"
};
