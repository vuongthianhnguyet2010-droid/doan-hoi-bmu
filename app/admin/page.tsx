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
  trang_thai: "draft" | "published" | "closed";
  so_luong_sinh_vien: number;
};

const emptyForm = {
  ten_chuong_trinh: "",
  mo_ta: "",
  ngay_bat_dau: "",
  ngay_ket_thuc: "",
  don_vi_to_chuc: "",
};

function normalizeUnit(value: string | null) {
  if (!value) return "";

  const normalized = value.toLowerCase();

  if (normalized.includes("đoàn")) {
    return "Đoàn Thanh niên";
  }

  if (normalized.includes("hội")) {
    return "Hội Sinh viên";
  }

  return "";
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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
    setEditingId(program.id);

    setForm({
      ten_chuong_trinh: program.ten_chuong_trinh || "",
      mo_ta: program.mo_ta || "",
      ngay_bat_dau: program.ngay_bat_dau || "",
      ngay_ket_thuc: program.ngay_ket_thuc || "",
      don_vi_to_chuc: normalizeUnit(program.don_vi_to_chuc),
    });

    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.ten_chuong_trinh.trim()) {
      setError("Vui lòng nhập tên chương trình.");
      return;
    }

    if (!form.don_vi_to_chuc) {
      setError("Vui lòng chọn đơn vị tổ chức.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/chuong-trinh", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          editingId ? { id: editingId, ...form } : form
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Không lưu được chương trình.");
        return;
      }

      setMessage(
        editingId
          ? "Đã cập nhật chương trình thành công."
          : "Đã thêm chương trình thành công."
      );

      resetForm();
      await loadPrograms(token);
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
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
        <h2 style={{ color: "#174783", marginTop: 0 }}>
          {editingId ? "Chỉnh sửa chương trình" : "Thêm chương trình mới"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Tên chương trình *
              <input
                style={inputStyle}
                value={form.ten_chuong_trinh}
                onChange={(e) =>
                  setForm({ ...form, ten_chuong_trinh: e.target.value })
                }
                placeholder="Nhập tên chương trình"
                required
              />
            </label>

            <label style={labelStyle}>
              Đơn vị tổ chức *
              <select
                style={inputStyle}
                value={form.don_vi_to_chuc}
                onChange={(e) =>
                  setForm({ ...form, don_vi_to_chuc: e.target.value })
                }
                required
              >
                <option value="">-- Chọn đơn vị tổ chức --</option>
                <option value="Đoàn Thanh niên">Đoàn Thanh niên</option>
                <option value="Hội Sinh viên">Hội Sinh viên</option>
              </select>
            </label>

            <label style={labelStyle}>
              Ngày bắt đầu
              <input
                type="date"
                style={inputStyle}
                value={form.ngay_bat_dau}
                onChange={(e) =>
                  setForm({ ...form, ngay_bat_dau: e.target.value })
                }
              />
            </label>

            <label style={labelStyle}>
              Ngày kết thúc
              <input
                type="date"
                style={inputStyle}
                value={form.ngay_ket_thuc}
                onChange={(e) =>
                  setForm({ ...form, ngay_ket_thuc: e.target.value })
                }
              />
            </label>
          </div>

          <label style={labelStyle}>
            Mô tả chương trình
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={form.mo_ta}
              onChange={(e) =>
                setForm({ ...form, mo_ta: e.target.value })
              }
              placeholder="Nhập mô tả chương trình..."
            />
          </label>

          {error && <p style={{ color: "#dc2626" }}>{error}</p>}
          {message && <p style={{ color: "#15803d" }}>{message}</p>}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button type="submit" disabled={saving} style={buttonStyle}>
              {saving
                ? "Đang lưu..."
                : editingId
                ? "Lưu thay đổi"
                : "Thêm chương trình"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{ ...buttonStyle, background: "#64748b" }}
              >
                Hủy chỉnh sửa
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ color: "#174783", marginTop: 0 }}>
          Danh sách chương trình ({programs.length})
        </h2>

        {programs.length === 0 ? (
          <p>Chưa có chương trình nào.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 800,
              }}
            >
              <thead>
                <tr style={{ background: "#eff6ff" }}>
                  {[
                    "Tên chương trình",
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
                    <td style={cellStyle}>
                      <strong>{program.ten_chuong_trinh}</strong>
                      {program.mo_ta && (
                        <p style={{ margin: "5px 0", color: "#64748b" }}>
                          {program.mo_ta}
                        </p>
                      )}
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
                          onClick={() => handleEdit(program)}
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

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 11,
  marginTop: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  font: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 16,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 16,
};

const cellStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  verticalAlign: "top",
};