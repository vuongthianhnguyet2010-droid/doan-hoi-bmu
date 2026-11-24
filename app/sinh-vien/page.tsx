
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Student = {
  id: string;
  mssv: string;
  ho_ten: string;
  lop: string | null;
  email: string | null;
};

type Certificate = {
  id: string;
  so_chung_nhan: string | null;
  file_url: string | null;
  trang_thai: string | null;
  ngay_phat_hanh: string | null;
};

type Program = {
  id: string;
  program_id: string;
  ngay_tham_gia: string | null;
  program: {
    ten_chuong_trinh: string;
    mo_ta: string | null;
    ngay_bat_dau: string | null;
    ngay_ket_thuc: string | null;
    don_vi_to_chuc: string | null;
  } | null;
  certificate: Certificate | null;
  trang_thai_gcn: string;
};

export default function StudentPage() {
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/sinh-vien/dang-nhap");
        return;
      }

      try {
        const [studentResponse, programResponse] = await Promise.all([
          fetch("/api/sinh-vien/thong-tin", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/sinh-vien/chuong-trinh", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const studentResult = await studentResponse.json();
        const programResult = await programResponse.json();

        if (!studentResponse.ok) {
          setError(studentResult.message || "Không tải được hồ sơ sinh viên.");
          return;
        }

        if (!programResponse.ok) {
          setError(
            programResult.message || "Không tải được danh sách chương trình."
          );
          return;
        }

        setStudent(studentResult.student);
        setPrograms(programResult.programs || []);
      } catch {
        setError("Không thể kết nối máy chủ.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/sinh-vien/dang-nhap");
  }

  async function handleViewCertificate(participantId: string) {
    if (viewingId) return;

    setViewingId(participantId);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/sinh-vien/dang-nhap");
        return;
      }

      const response = await fetch(
        `/api/sinh-vien/chuong-trinh/${participantId}/giay-chung-nhan`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "Không thể xem giấy chứng nhận.");
        return;
      }

      if (!result.signedUrl) {
        alert("Không nhận được đường dẫn giấy chứng nhận.");
        return;
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      alert("Không thể kết nối máy chủ.");
    } finally {
      setViewingId("");
    }
  }

  if (loading) {
    return <main style={mainStyle}>Đang tải thông tin...</main>;
  }

  if (error || !student) {
    return (
      <main style={mainStyle}>
        <section style={cardStyle}>
          <h2>Không thể truy cập</h2>
          <p style={{ color: "#dc2626" }}>
            {error || "Không tìm thấy hồ sơ."}
          </p>
          <button onClick={handleLogout} style={buttonStyle}>
            Đăng xuất
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ color: "#174783", margin: 0 }}>ĐOÀN – HỘI BMU</h1>
          <p style={{ marginBottom: 0, color: "#64748b" }}>
            Hệ thống giấy chứng nhận
          </p>
        </div>

        <button onClick={handleLogout} style={buttonStyle}>
          Đăng xuất
        </button>
      </header>

      <section style={cardStyle}>
        <h2 style={{ color: "#174783", marginTop: 0 }}>
          Xin chào, {student.ho_ten}!
        </h2>

        <p style={{ color: "#64748b" }}>
          Chào mừng bạn đến với hệ thống giấy chứng nhận Đoàn – Hội BMU.
        </p>

        <div style={infoStyle}>
          <Info label="Mã số sinh viên" value={student.mssv} />
          <Info label="Họ và tên" value={student.ho_ten} />
          <Info label="Lớp" value={student.lop || "Chưa cập nhật"} />
          <Info label="Email" value={student.email || "Chưa cập nhật"} />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ color: "#174783", marginTop: 0 }}>
          Chương trình đã tham gia
        </h2>

        {programs.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            Bạn chưa có chương trình tham gia nào.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {programs.map((item) => (
              <article key={item.id} style={programStyle}>
                <h3 style={{ color: "#174783", marginTop: 0 }}>
                  {item.program?.ten_chuong_trinh || "Chương trình"}
                </h3>

                {item.program?.mo_ta && <p>{item.program.mo_ta}</p>}

                <p>
                  <strong>Ngày tham gia:</strong>{" "}
                  {formatDate(item.ngay_tham_gia)}
                </p>

                <p>
                  <strong>Đơn vị tổ chức:</strong>{" "}
                  {item.program?.don_vi_to_chuc || "Chưa cập nhật"}
                </p>

                <div style={certificateBoxStyle}>
                  <strong style={{ color: "#174783" }}>
                    Trạng thái giấy chứng nhận
                  </strong>

                  <div style={{ marginTop: 10 }}>
                    <CertificateStatus status={item.trang_thai_gcn} />
                  </div>

                  {item.certificate?.so_chung_nhan && (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Số giấy chứng nhận:</strong>{" "}
                      {item.certificate.so_chung_nhan}
                    </p>
                  )}

                  {item.certificate?.ngay_phat_hanh && (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Ngày phát hành:</strong>{" "}
                      {formatDate(item.certificate.ngay_phat_hanh)}
                    </p>
                  )}

                  {isIssued(item.trang_thai_gcn) &&
                    item.certificate?.file_url && (
                      <button
                        onClick={() => handleViewCertificate(item.id)}
                        disabled={viewingId !== ""}
                        style={{
                          ...viewButtonStyle,
                          opacity: viewingId === item.id ? 0.7 : 1,
                          cursor: viewingId ? "wait" : "pointer",
                        }}
                      >
                        {viewingId === item.id
                          ? "Đang mở giấy chứng nhận..."
                          : "Xem giấy chứng nhận"}
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function isIssued(status: string) {
  return ["da_phat_hanh", "đã phát hành"].includes(
    (status || "").toLowerCase().trim()
  );
}

function CertificateStatus({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase().trim();

  if (isIssued(normalized)) {
    return <span style={issuedStyle}>✓ Đã phát hành</span>;
  }

  if (["da_thu_hoi", "đã thu hồi", "thu_hoi"].includes(normalized)) {
    return <span style={revokedStyle}>Đã thu hồi</span>;
  }

  return <span style={pendingStyle}>Đang chờ phát hành</span>;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";

  return new Date(
    value + (value.length === 10 ? "T00:00:00" : "")
  ).toLocaleDateString("vi-VN");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoItemStyle}>
      <span style={{ color: "#64748b", fontSize: 14 }}>{label}</span>
      <strong style={{ color: "#1e293b", marginTop: 6 }}>{value}</strong>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f6fb",
  padding: 24,
  color: "#1e293b",
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
  maxWidth: 1000,
  margin: "0 auto",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 1000,
  margin: "24px auto",
  padding: 28,
  background: "white",
  borderRadius: 14,
  boxShadow: "0 5px 20px #00000008",
};

const infoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginTop: 28,
};

const infoItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: 18,
  background: "#f8fafc",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
};

const programStyle: React.CSSProperties = {
  padding: 20,
  background: "#f8fafc",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
};

const certificateBoxStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 16,
  background: "white",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
};

const issuedStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 20,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 600,
  fontSize: 14,
};

const pendingStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 20,
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: 600,
  fontSize: 14,
};

const revokedStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 20,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 600,
  fontSize: 14,
};

const viewButtonStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 8,
  padding: "10px 16px",
  background: "#174783",
  color: "white",
  border: "none",
  textDecoration: "none",
  borderRadius: 8,
  fontWeight: 600,
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
