
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Program = {
  id: string;
  ten_chuong_trinh: string;
  mo_ta: string | null;
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  don_vi_to_chuc: string | null;
  so_quyet_dinh: string | null;
  trang_thai: "draft" | "published" | "closed";
  so_luong_sinh_vien: number;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        router.replace("/admin/login");
        return;
      }

      try {
        const response = await fetch("/api/admin/kiem-tra", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.message || "Không có quyền quản trị.");
          setLoading(false);
          return;
        }

        setToken(accessToken);
        await loadPrograms(accessToken);
      } catch {
        setError("Không thể kết nối máy chủ.");
        setLoading(false);
      }
    }

    init();
  }, [router]);

  async function loadPrograms(accessToken: string) {
    try {
      const response = await fetch("/api/admin/chuong-trinh", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Không tải được chương trình.");
      } else {
        setPrograms(result.programs || []);
        setError("");
      }
    } catch {
      setError("Không thể tải danh sách chương trình.");
    }

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  function handleEdit(program: Program) {
    router.push(`/admin/tao-hoat-dong?id=${program.id}`);
  }

  async function changeStatus(program: Program) {
    const nextStatus =
      program.trang_thai === "draft"
        ? "published"
        : program.trang_thai === "published"
        ? "closed"
        : "draft";

    const confirmText =
      nextStatus === "published"
        ? "Bạn muốn xuất bản chương trình này?"
        : nextStatus === "closed"
        ? "Bạn muốn đóng chương trình này?"
        : "Bạn muốn mở lại chương trình này?";

    if (!window.confirm(confirmText)) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/chuong-trinh", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: program.id,
          trang_thai: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Không đổi được trạng thái.");
        return;
      }

      setMessage("Đã cập nhật trạng thái chương trình.");
      await loadPrograms(token);
    } catch {
      setError("Không thể kết nối máy chủ.");
    }
  }

  function statusLabel(status: string) {
    if (status === "published") return "Đã xuất bản";
    if (status === "closed") return "Đã đóng";
    return "Bản nháp";
  }

  if (loading) {
    return <main style={{ padding: 40 }}>Đang tải dữ liệu...</main>;
  }

  if (error && !token) {
    return (
      <main style={{ padding: 40 }}>
        <h2>Không thể truy cập</h2>
        <p>{error}</p>
        <button onClick={handleLogout}>Đăng xuất</button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f6fb",
        padding: 24,
        color: "#1e293b",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "white",
          padding: 24,
          borderRadius: 14,
        }}
      >
        <div>
          <h1 style={{ color: "#174783", margin: 0 }}>
            QUẢN TRỊ ĐOÀN – HỘI BMU
          </h1>
          <p style={{ marginBottom: 0 }}>
            Hệ thống quản lý giấy chứng nhận
          </p>
        </div>

        <button onClick={handleLogout} style={buttonStyle}>
          Đăng xuất
        </button>
      </header>

      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2 style={{ color: "#174783", margin: 0 }}>
            Danh sách chương trình ({programs.length})
          </h2>

          <button
            onClick={() => router.push("/admin/tao-hoat-dong")}
            style={buttonStyle}
          >
            + Tạo hoạt động
          </button>
        </div>

        {error && <p style={{ color: "#dc2626" }}>{error}</p>}
        {message && <p style={{ color: "#15803d" }}>{message}</p>}

        {programs.length === 0 ? (
          <p style={{ marginTop: 20 }}>Chưa có chương trình nào.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 900,
              }}
            >
              <thead>
                <tr style={{ background: "#eff6ff" }}>
                  {[
                    "Tên chương trình",
                    "Số QĐ",
                    "Thời gian",
                    "Đơn vị",
                    "Trạng thái",
                    "Số sinh viên",
                    "Thao tác",
                  ].map((item) => (
                    <th key={item} style={cellStyle}>
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {programs.map((program) => (
                  <tr key={program.id}>
                   <td style={{ ...cellStyle, width: 280, maxWidth: 280 }}>
                    <strong
                      style={{
                        display: "block",
                        overflowWrap: "anywhere",
                        whiteSpace: "normal",
                      }}
                    >
                      {program.ten_chuong_trinh}
                    </strong>
                      {program.mo_ta && (
                        <p style={{ margin: "5px 0", color: "#64748b" }}>
                          {program.mo_ta}
                        </p>
                      )}
                    </td>

                    <td style={cellStyle}>
                      {program.so_quyet_dinh || "—"}
                    </td>

                    <td style={cellStyle}>
                      {program.ngay_bat_dau || "—"}
                      <br />
                      {program.ngay_ket_thuc || "—"}
                    </td>

                    <td style={cellStyle}>
                      {program.don_vi_to_chuc || "—"}
                    </td>

                    <td style={cellStyle}>
                      {statusLabel(program.trang_thai)}
                    </td>

                    <td style={cellStyle}>
                      <strong style={{ color: "#174783", fontSize: 16 }}>
                        {program.so_luong_sinh_vien || 0}
                      </strong>
                      {" sinh viên"}
                    </td>

                    <td style={cellStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() =>
                            router.push(`/admin/chuong-trinh/${program.id}`)
                          }
                          style={smallButtonStyle}
                        >
                          Chi tiết
                        </button>

                        <button
                          onClick={() =>
                            router.push(
                              `/admin/chuong-trinh/${program.id}/sinh-vien`
                            )
                          }
                          style={smallButtonStyle}
                        >
                          Sinh viên
                        </button>

                        <button
                          onClick={() => router.push(`/admin/tao-hoat-dong?id=${program.id}`)}
                          style={smallButtonStyle}
                        >
                          Sửa
                        </button>

                        <button
                          onClick={() => changeStatus(program)}
                          style={{
                            ...smallButtonStyle,
                            background: "#475569",
                          }}
                        >
                          {program.trang_thai === "draft"
                            ? "Xuất bản"
                            : program.trang_thai === "published"
                            ? "Đóng"
                            : "Mở lại"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 14,
  marginTop: 24,
};

const buttonStyle: React.CSSProperties = {
  background: "#174783",
  color: "white",
  border: "none",
  padding: "11px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "7px 12px",
  fontSize: 13,
};

const cellStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  verticalAlign: "top",
};
