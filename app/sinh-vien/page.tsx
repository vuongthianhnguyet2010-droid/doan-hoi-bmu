
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
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState("");

  // Chỉnh sửa thông tin
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  // Đổi mật khẩu
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Mở form chỉnh sửa
  function openEditProfile() {
    if (!student) return;

    setEditName(student.ho_ten);
    setEditClass(student.lop || "");
    setEditMessage("");
    setEditOpen(true);
  }

  // Lưu thông tin
  async function handleUpdateProfile() {
    if (!editName.trim()) {
      setEditMessage("Họ và tên không được để trống.");
      return;
    }

    setEditLoading(true);
    setEditMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/sinh-vien/dang-nhap");
        return;
      }

      const response = await fetch("/api/sinh-vien/cap-nhat-thong-tin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ho_ten: editName.trim(),
          lop: editClass.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setEditMessage(result.message || "Cập nhật thất bại.");
        return;
      }

      setStudent((prev) =>
        prev
          ? {
              ...prev,
              ho_ten: editName.trim(),
              lop: editClass.trim() || null,
            }
          : prev
      );

      setEditOpen(false);
      alert(result.message || "Cập nhật thông tin thành công.");
    } catch {
      setEditMessage("Không thể kết nối máy chủ.");
    } finally {
      setEditLoading(false);
    }
  }

  // Mở form đổi mật khẩu
  function openChangePassword() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwMessage("");
    setPwOpen(true);
  }

  // Đổi mật khẩu
  async function handleChangePassword() {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwMessage("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (newPassword.length < 8) {
      setPwMessage("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (oldPassword === newPassword) {
      setPwMessage("Mật khẩu mới phải khác mật khẩu hiện tại.");
      return;
    }

    setPwLoading(true);
    setPwMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/sinh-vien/dang-nhap");
        return;
      }

      const response = await fetch("/api/sinh-vien/doi-mat-khau", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mat_khau_cu: oldPassword,
          mat_khau_moi: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setPwMessage(result.message || "Đổi mật khẩu thất bại.");
        return;
      }

      setPwOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      alert(result.message || "Đổi mật khẩu thành công.");
    } catch {
      setPwMessage("Không thể kết nối máy chủ.");
    } finally {
      setPwLoading(false);
    }
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

  // Lọc chương trình theo tên
  const filteredPrograms = programs.filter((item) =>
    item.program?.ten_chuong_trinh
      ?.toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  );

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

      {/* HEADER + HỒ SƠ SINH VIÊN */}
      <div className="student-mobile-panel">

        {/* LOGO LUÔN HIỂN THỊ */}
        <div className="student-logo">
          <img
            src="/logo-doan-hoi-bmu.png"
            alt="ĐOÀN – HỘI BMU"
            style={{ width: 220, height: "auto", objectFit: "contain" }}
          />
          <p style={{ marginBottom: 0, color: "#64748b" }}>
            HỆ THỐNG QUẢN LÝ HOẠT ĐỘNG
          </p>
        </div>

        {/* DÒNG RÚT GỌN */}
        <div className="mobile-greeting">
          <strong>Xin chào, {student.ho_ten}!</strong>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-toggle"
          >
            {mobileMenuOpen ? "▲ Thu gọn" : "☰ Menu"}
          </button>
        </div>

        {/* NỘI DUNG MENU */}
        <div className={`student-panel-content ${mobileMenuOpen ? "open" : ""}`}>
          <header className="student-header">
            <button onClick={handleLogout} style={buttonStyle}>
              Đăng xuất
            </button>
          </header>

          <section style={cardStyle}>
            <p style={{ color: "#64748b" }}>
              Chào mừng bạn đến với hệ thống giấy chứng nhận Đoàn – Hội BMU.
            </p>

            <div style={infoStyle}>
              <Info label="Mã số sinh viên" value={student.mssv} />
              <Info label="Họ và tên" value={student.ho_ten} />
              <Info label="Lớp" value={student.lop || "Chưa cập nhật"} />
              <Info label="Email" value={student.email || "Chưa cập nhật"} />
            </div>

            <div style={actionGroupStyle}>
              <button onClick={openEditProfile} style={editButtonStyle}>
                Thông tin cá nhân
              </button>

              <button onClick={openChangePassword} style={passwordButtonStyle}>
                🔐 Đổi mật khẩu
              </button>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .student-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 16px;
          background: white;
          padding: 16px;
          border-radius: 12px;
        }

        .mobile-greeting {
          display: none;
        }

        .student-panel-content {
          display: block;
        }

        @media (max-width: 768px) {
          .student-logo {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            margin-bottom: 16px;
            background: white;
            padding: 16px;
            border-radius: 12px;
          }

          .mobile-greeting {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 12px 16px;
            background: #fff;
            border-radius: 12px;
            color: #174783;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }

          .mobile-greeting strong {
            font-size: 15px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-menu-toggle {
            flex-shrink: 0;
            border: none;
            background: #174783;
            color: white;
            padding: 9px 12px;
            border-radius: 8px;
            cursor: pointer;
          }

          .student-panel-content {
            display: none;
          }

          .student-panel-content.open {
            display: block;
          }

          .student-header {
            display: flex;
            justify-content: flex-end;
            margin-top: 12px;
          }
        }
      `}</style>

      {/* DANH SÁCH CHƯƠNG TRÌNH */}
      <section style={cardStyle}>
        <h2 style={{ color: "#174783", marginTop: 0 }}>
          Chương trình đã tham gia
        </h2>

        {programs.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            Bạn chưa có chương trình tham gia nào.
          </p>
        ) : (
          <>
            {/* THANH TÌM KIẾM */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 18,
                  color: "#64748b",
                }}
              >
                🔍
              </span>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm tên chương trình..."
                style={{
                  ...inputStyle,
                  paddingLeft: 44,
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                }}
              />
            </div>

            {filteredPrograms.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: 20 }}>
                Không tìm thấy chương trình phù hợp.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {filteredPrograms.map((item) => (
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
          </>
        )}
      </section>

      {/* MODAL CHỈNH SỬA THÔNG TIN */}
      {editOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={modalTitleStyle}>✏️ Chỉnh sửa thông tin</h2>

            <label style={labelStyle}>Mã số sinh viên</label>
            <input
              value={student.mssv}
              disabled
              style={disabledInputStyle}
            />

            <label style={labelStyle}>Email</label>
            <input
              value={student.email || ""}
              disabled
              style={disabledInputStyle}
            />

            <label style={labelStyle}>Họ và tên</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nhập họ và tên"
              style={inputStyle}
            />

            <label style={labelStyle}>Lớp</label>
            <input
              value={editClass}
              onChange={(e) => setEditClass(e.target.value)}
              placeholder="Nhập lớp"
              style={inputStyle}
            />

            {editMessage && (
              <p style={messageErrorStyle}>{editMessage}</p>
            )}

            <div style={modalActionsStyle}>
              <button
                onClick={() => setEditOpen(false)}
                disabled={editLoading}
                style={cancelButtonStyle}
              >
                Hủy
              </button>

              <button
                onClick={handleUpdateProfile}
                disabled={editLoading}
                style={buttonStyle}
              >
                {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI MẬT KHẨU */}
      {pwOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={modalTitleStyle}>🔐 Đổi mật khẩu</h2>

            <label style={labelStyle}>Mật khẩu hiện tại</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              style={inputStyle}
              autoComplete="current-password"
            />

            <label style={labelStyle}>Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              style={inputStyle}
              autoComplete="new-password"
            />

            <label style={labelStyle}>Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              style={inputStyle}
              autoComplete="new-password"
            />

            {pwMessage && <p style={messageErrorStyle}>{pwMessage}</p>}

            <div style={modalActionsStyle}>
              <button
                onClick={() => setPwOpen(false)}
                disabled={pwLoading}
                style={cancelButtonStyle}
              >
                Hủy
              </button>

              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                style={buttonStyle}
              >
                {pwLoading ? "Đang xử lý..." : "Đổi mật khẩu"}
              </button>
            </div>
          </div>
        </div>
      )}
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

const actionGroupStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 24,
};

const editButtonStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#174783",
  border: "1px solid #bfdbfe",
  padding: "11px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const passwordButtonStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
  padding: "11px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 16,
  zIndex: 1000,
  overflowY: "auto",
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "white",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 60px #00000030",
  maxHeight: "90vh",
  overflowY: "auto",
};

const modalTitleStyle: React.CSSProperties = {
  color: "#174783",
  marginTop: 0,
  marginBottom: 22,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
  marginTop: 16,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 15,
  background: "white",
  color: "#1e293b",
};

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#f1f5f9",
  color: "#64748b",
  cursor: "not-allowed",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 24,
  flexWrap: "wrap",
};

const cancelButtonStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
  padding: "11px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const messageErrorStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 14,
  marginTop: 14,
  marginBottom: 0,
};
