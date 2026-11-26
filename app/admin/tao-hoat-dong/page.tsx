
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

const emptyForm = {
  ten_chuong_trinh: "",
  mo_ta: "",
  ngay_bat_dau: "",
  ngay_ket_thuc: "",
  don_vi_to_chuc: "",
  so_quyet_dinh: "",
};

const PAGE_WIDTH = 2000;
const PAGE_HEIGHT = 1414;

function formatDate(date: Date) {
  return `${date.getDate()} tháng ${
    date.getMonth() + 1
  } năm ${date.getFullYear()}`;
}

function normalizeUnit(value: string) {
  if (value.toLowerCase().includes("đoàn")) {
    return "Đoàn Thanh niên";
  }

  if (value.toLowerCase().includes("hội")) {
    return "Hội Sinh viên";
  }

  return "";
}

export default function TaoHoatDongPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

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
          setError(
            result.message || "Bạn không có quyền quản trị."
          );
          setLoading(false);
          return;
        }

        setToken(accessToken);

// Kiểm tra ID chương trình trên URL
const params = new URLSearchParams(window.location.search);
const programId = params.get("id");

if (programId) {
  setEditingId(programId);

  const programResponse = await fetch("/api/admin/chuong-trinh", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const programResult = await programResponse.json();

  if (!programResponse.ok) {
    setError(programResult.message || "Không tải được chương trình.");
    return;
  }

  const program = (programResult.programs || []).find(
    (item: { id: string }) => item.id === programId
  );

  if (!program) {
    setError("Không tìm thấy chương trình cần chỉnh sửa.");
    return;
  }

  setForm({
    ten_chuong_trinh: program.ten_chuong_trinh || "",
    mo_ta: program.mo_ta || "",
    ngay_bat_dau: program.ngay_bat_dau || "",
    ngay_ket_thuc: program.ngay_ket_thuc || "",
    don_vi_to_chuc: normalizeUnit(program.don_vi_to_chuc || ""),
    so_quyet_dinh: program.so_quyet_dinh || "",
  });
}
      } catch {
        setError("Không thể kết nối máy chủ.");
      }

      setLoading(false);
    }

    init();
  }, [router]);

  const isDoan =
    form.don_vi_to_chuc.toLowerCase().includes("đoàn");

  const background = isDoan
    ? "/mau-gcn-doan.png"
    : "/mau-gcn-hoi-sinh-vien.png";

  const [ngayCap, setNgayCap] = useState("");

  function updateField(
    field: keyof typeof emptyForm,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setError("");
    setMessage("");
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
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
        editingId
            ? {
                id: editingId,
                ...form,
                ngay_bat_dau: null,
                ngay_ket_thuc: null,
            }
            : {
                ...form,
                ngay_bat_dau: null,
                ngay_ket_thuc: null,
            }
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
        : "Đã tạo chương trình thành công."
    );

    setForm(emptyForm);
    setEditingId(null);

    // Xóa ID khỏi URL để trở về chế độ tạo mới
    router.replace("/admin/tao-hoat-dong");
    } catch {
    setError("Không thể kết nối máy chủ.");
    } finally {
    setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        Đang kiểm tra quyền truy cập...
      </main>
    );
  }

  if (!token) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h2>Không thể truy cập</h2>
          <p>{error}</p>

          <button
            onClick={handleLogout}
            style={buttonStyle}
          >
            Đăng xuất
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, color: "#174783" }}>
            QUẢN TRỊ ĐOÀN – HỘI BMU
          </h1>

          <p style={{ marginBottom: 0 }}>
            Tạo chương trình và xem trước giấy chứng nhận
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/admin")}
            style={secondaryButtonStyle}
          >
            ← Quản trị
          </button>

          <button
            onClick={handleLogout}
            style={buttonStyle}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <div style={layoutStyle}>
        {/* KHU VỰC NHẬP LIỆU */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            {editingId ? "Chỉnh sửa chương trình" : "Thông tin chương trình"}
          </h2>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>
              Đơn vị tổ chức *

              <select
                style={inputStyle}
                value={form.don_vi_to_chuc}
                onChange={(e) =>
                  updateField(
                    "don_vi_to_chuc",
                    e.target.value
                  )
                }
                required
              >
                <option value="">
                  -- Chọn đơn vị tổ chức --
                </option>

                <option value="Đoàn Thanh niên">
                  Đoàn Thanh niên
                </option>

                <option value="Hội Sinh viên">
                  Hội Sinh viên
                </option>
              </select>
            </label>

           <label style={labelStyle}>
  Tên chương trình *

  <textarea
    style={{
      ...inputStyle,
      minHeight: 100,
      resize: "vertical",
      whiteSpace: "pre-wrap",
    }}
    value={form.ten_chuong_trinh}
    onChange={(e) =>
      updateField("ten_chuong_trinh", e.target.value)
    }
    placeholder="Nhập tên chương trình (Enter để xuống dòng)"
    required
  />
</label>

            <label style={labelStyle}>
              Số Quyết định

              <input
                style={inputStyle}
                value={form.so_quyet_dinh}
                onChange={(e) =>
                  updateField(
                    "so_quyet_dinh",
                    e.target.value
                  )
                }
                placeholder="Nhập số Quyết định"
              />
            </label>
            <div>
  <label className="block text-sm font-medium mb-1">
    Ngày cấp giấy chứng nhận
  </label>
  <input
    type="date"
    value={ngayCap}
    onChange={(e) => setNgayCap(e.target.value)}
    className="w-full border rounded-lg px-3 py-2"
  />
</div>

            {error && (
              <div style={errorStyle}>
                {error}
              </div>
            )}

            {message && (
              <div style={successStyle}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                ...buttonStyle,
                width: "100%",
                marginTop: 12,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? "Đang lưu..."
                : editingId
                ? "Lưu thay đổi"
                : "Lưu chương trình"}
            </button>
          </form>
        </section>

        {/* KHU VỰC XEM TRƯỚC */}
        <section style={previewCardStyle}>
          <div style={previewHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                Xem trước giấy chứng nhận
              </h2>

              <p style={{ margin: "5px 0", color: "#64748b" }}>
                {form.don_vi_to_chuc || "Chưa chọn đơn vị"}
              </p>
            </div>
          </div>

          {!form.don_vi_to_chuc ? (
            <div style={emptyPreviewStyle}>
              <div style={{ fontSize: 40 }}>📄</div>

              <p>
                Chọn đơn vị tổ chức để xem mẫu giấy chứng nhận.
              </p>
            </div>
          ) : (
            <div style={previewOuterStyle}>
              <div
                style={{
                  ...certificateStyle,
                  aspectRatio: `${PAGE_WIDTH}/${PAGE_HEIGHT}`,
                }}
              >
                <img
                  src={background}
                  alt="Nền giấy chứng nhận"
                  style={backgroundStyle}
                />

                {/* LOGO */}
<img
  src="/logo-doan-hoi-bmu.png"
  alt="Logo Đoàn - Hội BMU"
  style={{
    position: "absolute",
    left: "50%",
    top: "0%",
    width: "18%",
    height: "20%",
    objectFit: "contain",
    transform: "translateX(-50%)",
    zIndex: 2,
  }}
/>
                {/* NỘI DUNG ĐOÀN */}
                {isDoan ? (
                  <>
                    <PreviewText
                      text="ĐOÀN THANH NIÊN CỘNG SẢN HỒ CHÍ MINH"
                      top={190}
                      size={43}
                      bold
                      color="#6b2e21"
                    />

                    <PreviewText
                      text="TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT"
                      top={250}
                      size={43}
                      bold
                      color="#6b2e21"
                    />

                    <PreviewText
                      text="CHỨNG NHẬN"
                      top={340}
                      size={100}
                      bold
                      color="#de0526"
                    />

                    <PreviewText
                      text="Sinh viên: [Họ và tên]"
                      top={475}
                      size={82}
                      bold
                      italic
                      color="#6b2e21"
                    />

                    <PreviewText
                      text="Chi đoàn: [Lớp]"
                      top={600}
                      size={66}
                      bold
                      italic
                      color="#6b2e21"
                    />

                    <PreviewText
                      text={` ${
                        form.ten_chuong_trinh || "[Tên chương trình]"
                      }${
                        form.ngay_bat_dau
                          ? ` tháng ${new Date(
                              form.ngay_bat_dau
                            ).getMonth() + 1} năm ${new Date(
                              form.ngay_bat_dau
                            ).getFullYear()}`
                          : ""
                      }`}
                      top={720}
                      size={54}
                      bold
                      italic
                      color="#6b2e21"
                    />

                    <PreviewText
                      text={`Đắk Lắk, ngày ${ngayCap ? formatDate(new Date(ngayCap + "T12:00:00")) : ""}`}
                      top={960}
                      size={42}
                      italic
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="TM. BAN CHẤP HÀNH"
                      top={1010}
                      size={42}
                      bold
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="BÍ THƯ"
                      top={1060}
                      size={42}
                      bold
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="Trịnh Thị Xuân Giang"
                      top={1210}
                      size={44}
                      bold
                      italic
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    {form.so_quyet_dinh && (
                      <PreviewText
                        text={`Số: ${form.so_quyet_dinh}/QĐ-ĐTN`}
                        top={1280}
                        size={36}
                        bold
                        color="#6b2e21"
                        left={135}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <PreviewText
                      text="HỘI SINH VIÊN VIỆT NAM TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT"
                      top={190}
                      size={43}
                      bold
                      color="#6b2e21"
                    />

                    <PreviewText
                      text="CHỨNG NHẬN"
                      top={275}
                      size={100}
                      bold
                      color="#de0526"
                    />

                    <PreviewText
                      text="Sinh viên: [Họ và tên]"
                      top={420}
                      size={82}
                      bold
                      italic
                      color="#6b2e21"
                    />

                    <PreviewText
                      text="Chi hội: [Lớp]"
                      top={555}
                      size={66}
                      bold
                      italic
                      color="#6b2e21"
                    />

                    <PreviewText
                      text={` ${form.ten_chuong_trinh || "[Tên chương trình]"}`}
                      top={680}
                      size={54}
                      italic
                      color="#6b2e21"
                    />

                    <PreviewText
                      text={`Đắk Lắk, ngày ${ngayCap ? formatDate(new Date(ngayCap + "T12:00:00")) : ""}`}
                      top={920}
                      size={42}
                      italic
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="TM. BAN THƯ KÝ HỘI SINH VIÊN VIỆT NAM"
                      top={970}
                      size={36}
                      bold
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT"
                      top={1014}
                      size={36}
                      bold
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="CHỦ TỊCH"
                      top={1058}
                      size={36}
                      bold
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text="Trịnh Thị Xuân Giang"
                      top={1200}
                      size={44}
                      bold
                      italic
                      color="#6b2e21"
                      areaLeft={1050}
                      areaWidth={850}
                    />

                    <PreviewText
                      text={`Số: ${form.so_quyet_dinh}/QĐ-HSV`}
                      top={1280}
                      size={36}
                      bold
                      color="#6b2e21"
                      left={135}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <div style={previewNoteStyle}>
            <strong>Lưu ý:</strong> Đây là bản xem trước bố cục.
            Họ tên và lớp được thay bằng dữ liệu sinh viên khi
            hệ thống phát hành GCN. Ngày cấp và số GCN sẽ được
            xử lý theo API phát hành hiện tại.
          </div>
        </section>
      </div>
    </main>
  );
}

function PreviewText({
  text,
  top,
  size,
  bold = false,
  italic = false,
  color = "#6b2e21",
  left,
  areaLeft,
  areaWidth,
}: {
  text: string;
  top: number;
  size: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  left?: number;
  areaLeft?: number;
  areaWidth?: number;
}) {
  const isArea = areaLeft !== undefined && areaWidth !== undefined;

  const positionStyle: React.CSSProperties = isArea
    ? {
        left: `${(areaLeft / PAGE_WIDTH) * 100}%`,
        width: `${(areaWidth / PAGE_WIDTH) * 100}%`,
      }
    : left !== undefined
    ? {
        left: `${(left / PAGE_WIDTH) * 100}%`,
      }
    : {
        left: "50%",
        width: "90%",
        transform: "translateX(-50%)",
      };

  return (
    <div
      style={{
        position: "absolute",
        top: `${(top / PAGE_HEIGHT) * 100}%`,
        ...positionStyle,
        fontFamily: "Times New Roman, serif",
        fontSize: `${(size / PAGE_HEIGHT) * 100}cqh`,
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? "italic" : "normal",
        color,
        textAlign: isArea ? "center" : left !== undefined ? "left" : "center",
        whiteSpace: "pre-wrap",
        lineHeight: 1.25,
        overflowWrap: "break-word",
      }}
    >
      {text}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f6fb",
  padding: 24,
  color: "#1e293b",
  boxSizing: "border-box",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
  background: "white",
  padding: 24,
  borderRadius: 14,
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 0.85fr) minmax(0, 1.5fr)",
  gap: 24,
  marginTop: 24,
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 14,
  boxSizing: "border-box",
};

const previewCardStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 14,
  minWidth: 0,
  boxSizing: "border-box",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#174783",
  marginTop: 0,
  marginBottom: 22,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 18,
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

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
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

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#64748b",
};

const errorStyle: React.CSSProperties = {
  padding: 12,
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 8,
  marginTop: 12,
};

const successStyle: React.CSSProperties = {
  padding: 12,
  background: "#f0fdf4",
  color: "#15803d",
  borderRadius: 8,
  marginTop: 12,
};

const previewHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 16,
};

const previewOuterStyle: React.CSSProperties = {
  width: "100%",
  overflow: "hidden",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#e2e8f0",
};

const certificateStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  containerType: "size",
  overflow: "hidden",
  background: "white",
};

const backgroundStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "fill",
};

const logoDoanStyle: React.CSSProperties = {
  position: "absolute",
  left: "8.5%",
  top: "4.6%",
  width: "4.5%",
  height: "7.8%",
  objectFit: "contain",
};

const logoBMUStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "4.6%",
  width: "11.5%",
  height: "7.8%",
  transform: "translateX(-50%)",
  objectFit: "contain",
};

const logoHoiStyle: React.CSSProperties = {
  position: "absolute",
  right: "8.5%",
  top: "4.6%",
  width: "4.5%",
  height: "7.8%",
  objectFit: "contain",
};

const emptyPreviewStyle: React.CSSProperties = {
  minHeight: 300,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 10,
  color: "#64748b",
};

const previewNoteStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  background: "#f8fafc",
  borderRadius: 8,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};
