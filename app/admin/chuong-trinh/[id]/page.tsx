
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

function ProgramDetailContent() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProgram() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/admin/login");
        return;
      }

      try {
        const response = await fetch("/api/admin/chuong-trinh", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.message || "Không tải được chương trình.");
          return;
        }

        const found = (result.programs || []).find(
          (item: Program) => item.id === programId
        );

        if (!found) {
          setError("Không tìm thấy chương trình.");
          return;
        }

        setProgram(found);
      } catch {
        setError("Không thể kết nối máy chủ.");
      } finally {
        setLoading(false);
      }
    }

    loadProgram();
  }, [programId, router]);

  function statusLabel(status: string) {
    if (status === "published") return "Đã xuất bản";
    if (status === "closed") return "Đã đóng";
    return "Bản nháp";
  }

  if (loading) {
    return <main style={{ padding: 30 }}>Đang tải thông tin...</main>;
  }

  if (error || !program) {
    return (
      <main style={{ padding: 30, color: "#dc2626" }}>
        <p>{error || "Không tìm thấy chương trình."}</p>
        <button onClick={() => router.push("/admin")}>
          Quay lại quản trị
        </button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/admin")} style={buttonStyle}>
        ← Quay lại quản trị
      </button>

      <section style={sectionStyle}>
        <h1 style={{ color: "#174783", marginTop: 0 }}>
          Chi tiết chương trình
        </h1>

        <h2 style={{ color: "#1e293b" }}>
          {program.ten_chuong_trinh}
        </h2>

        <div style={infoStyle}>
          <strong>Mô tả:</strong>
          <p>{program.mo_ta || "Chưa có mô tả."}</p>
        </div>

        <div style={infoStyle}>
          <strong>Đơn vị tổ chức:</strong>
          <p>{program.don_vi_to_chuc || "Chưa cập nhật"}</p>
        </div>

        <div style={infoStyle}>
          <strong>Thời gian tổ chức:</strong>
          <p>
            {program.ngay_bat_dau || "Chưa xác định"}
            {" – "}
            {program.ngay_ket_thuc || "Chưa xác định"}
          </p>
        </div>

        <div style={infoStyle}>
          <strong>Trạng thái:</strong>
          <p>{statusLabel(program.trang_thai)}</p>
        </div>

        <div style={statBox}>
          <div style={{ fontSize: 15 }}>Tổng số sinh viên tham gia</div>
          <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>
            {program.so_luong_sinh_vien || 0}
          </div>
          <div> sinh viên</div>
        </div>

        <button
          onClick={() =>
            router.push(`/admin/chuong-trinh/${program.id}/sinh-vien`)
          }
          style={{ ...buttonStyle, marginTop: 20 }}
        >
          Quản lý danh sách sinh viên
        </button>
      </section>
    </main>
  );
}

export default function ProgramDetailPage() {
  return (
    <Suspense fallback={<main style={{ padding: 30 }}>Đang tải...</main>}>
      <ProgramDetailContent />
    </Suspense>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f6fb",
  padding: 24,
  color: "#1e293b",
};

const sectionStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 14,
  marginTop: 20,
  maxWidth: 850,
};

const infoStyle: React.CSSProperties = {
  padding: "12px 0",
  borderBottom: "1px solid #e2e8f0",
};

const statBox: React.CSSProperties = {
  marginTop: 24,
  padding: 24,
  borderRadius: 12,
  background: "#eff6ff",
  color: "#174783",
  textAlign: "center",
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
