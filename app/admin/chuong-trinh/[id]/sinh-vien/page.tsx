
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import * as XLSX from "xlsx";

type Student = {
  id: string;
  mssv: string;
  ho_ten: string;
  lop: string | null;
};

type Certificate = {
  id: string;
  participant_id: string;
  so_chung_nhan: string;
  file_url: string;
  trang_thai: string;
  ngay_phat_hanh: string | null;
};

type Participant = {
  id: string;
  student_id: string;
  ngay_tham_gia: string;
  students: Student | Student[] | null;
  certificate: Certificate | null;
};

type ExcelStudent = {
  mssv: string;
  ho_ten: string;
  lop: string;
};

function ProgramStudentsContent() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [token, setToken] = useState("");
  const [students, setStudents] = useState<Participant[]>([]);
  const [mssvList, setMssvList] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [certificateNumbers, setCertificateNumbers] =
    useState<Record<string, string>>({});
  const [certificateFiles, setCertificateFiles] =
    useState<Record<string, File | null>>({});
  const [issuingId, setIssuingId] = useState("");

  // Tạo GCN hàng loạt
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        router.replace("/admin/login");
        return;
      }

      setToken(accessToken);
      await loadStudents(accessToken);
    }

    init();
  }, [router, programId]);

  async function loadStudents(accessToken: string) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Không tải được danh sách sinh viên.");
      } else {
        setStudents(result.participants || []);
      }
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const mssvs = [
      ...new Set(
        mssvList
          .split(/[\s,;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    ];

    if (mssvs.length === 0) {
      setError("Vui lòng nhập ít nhất một MSSV.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ mssvs }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Không thêm được sinh viên.");
      } else {
        setMessage(
          `Đã thêm ${result.added || 0} sinh viên. Không tìm thấy: ${
            result.notFound?.length || 0
          } MSSV.`
        );

        setMssvList("");
        await loadStudents(token);
      }
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  function normalizeHeader(value: unknown) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ");
  }

  async function handleImportExcel(file: File) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) {
        throw new Error("File Excel không có dữ liệu.");
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: "",
      });

      if (rows.length < 2) {
        throw new Error("File Excel chưa có dữ liệu sinh viên.");
      }

      const headerRowIndex = rows.findIndex((row) => {
        const headers = row.map(normalizeHeader);

        const hasMssv = headers.some(
          (h) => h === "mssv" || h === "ma so sinh vien"
        );

        const hasName = headers.some(
          (h) => h === "ho va ten" || h === "ho ten" || h === "hoten"
        );

        return hasMssv && hasName;
      });

      if (headerRowIndex === -1 || headerRowIndex >= 15) {
        throw new Error(
          "Không tìm thấy dòng tiêu đề có MSSV và Họ và tên trong 15 dòng đầu tiên."
        );
      }

      const headers = rows[headerRowIndex].map(normalizeHeader);

      const mssvIndex = headers.findIndex(
        (h) => h === "mssv" || h === "ma so sinh vien"
      );

      const nameIndex = headers.findIndex(
        (h) => h === "ho va ten" || h === "ho ten" || h === "hoten"
      );

      const classIndex = headers.findIndex(
        (h) => h === "lop" || h === "ma lop"
      );

      if (mssvIndex === -1 || nameIndex === -1) {
        throw new Error("Không tìm thấy cột MSSV hoặc Họ và tên.");
      }

      const importedStudents: ExcelStudent[] = rows
        .slice(headerRowIndex + 1)
        .map((row) => ({
          mssv: String(row[mssvIndex] ?? "").trim(),
          ho_ten: String(row[nameIndex] ?? "").trim(),
          lop:
            classIndex !== -1
              ? String(row[classIndex] ?? "").trim()
              : "",
        }))
        .filter((item) => item.mssv !== "" && item.ho_ten !== "");

      if (importedStudents.length === 0) {
        throw new Error("Không có sinh viên hợp lệ trong file Excel.");
      }

      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ students: importedStudents }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Không nhập được danh sách Excel."
        );
      }

      setMessage(
        `Nhập Excel thành công! Đã thêm: ${
          result.added || 0
        }; tạo mới: ${result.created || 0}; bỏ qua trùng: ${
          result.skipped || 0
        }; không tìm thấy: ${result.notFound?.length || 0}.`
      );

      await loadStudents(token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể đọc file Excel."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Participant) {
    const student = Array.isArray(item.students)
      ? item.students[0]
      : item.students;

    if (item.certificate) {
      setError(
        "Sinh viên đã có hồ sơ giấy chứng nhận. Hãy thu hồi GCN trước khi xóa sinh viên."
      );
      return;
    }

    if (
      !window.confirm(
        `Bạn có chắc muốn xóa ${
          student?.ho_ten || "sinh viên"
        } khỏi chương trình này?`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ participantId: item.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Không xóa được sinh viên.");
        return;
      }

      setMessage("Đã xóa sinh viên khỏi chương trình.");
      await loadStudents(token);
    } catch {
      setError("Không thể kết nối máy chủ.");
    }
  }

  // Tạo giấy chứng nhận tự động từ mẫu
  async function handleAutoGenerate(item: Participant) {
    const student = Array.isArray(item.students)
      ? item.students[0]
      : item.students;

    if (!student) {
      setError("Không tìm thấy thông tin sinh viên.");
      return;
    }

    if (
      !window.confirm(
        `Xác nhận tạo giấy chứng nhận tự động cho ${student.ho_ten}?`
      )
    ) {
      return;
    }

    setIssuingId(item.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien/${item.id}/tao-tu-dong`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Không tạo được giấy chứng nhận.");
      }

      setMessage(`Đã tạo giấy chứng nhận tự động cho ${student.ho_ten}.`);

      await loadStudents(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tạo giấy chứng nhận tự động."
      );
    } finally {
      setIssuingId("");
    }
  }

  // Tạo giấy chứng nhận tự động hàng loạt
  async function handleBulkGenerate() {
    const eligibleStudents = students.filter((item) => {
      const status = getCertificateStatus(item.certificate);
      return status === "Chưa cấp" || status === "Đã thu hồi";
    });

    if (eligibleStudents.length === 0) {
      setError("Không có sinh viên nào cần tạo giấy chứng nhận.");
      return;
    }

    if (
      !window.confirm(
        `Bạn có chắc muốn tạo giấy chứng nhận tự động cho ${eligibleStudents.length} sinh viên chưa cấp hoặc đã thu hồi GCN?`
      )
    ) {
      return;
    }

    setBulkGenerating(true);
    setBulkProgress("");
    setError("");
    setMessage("");

    let success = 0;
    let failed = 0;
    const failedNames: string[] = [];

    try {
      for (let i = 0; i < eligibleStudents.length; i++) {
        const item = eligibleStudents[i];

        const student = Array.isArray(item.students)
          ? item.students[0]
          : item.students;

        const studentName = student?.ho_ten || item.student_id;

        setBulkProgress(
          `Đang tạo ${i + 1}/${eligibleStudents.length}: ${studentName}`
        );

        try {
          const response = await fetch(
            `/api/admin/chuong-trinh/${programId}/sinh-vien/${item.id}/tao-tu-dong`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.message || "Không tạo được giấy chứng nhận."
            );
          }

          success++;
        } catch {
          failed++;
          failedNames.push(studentName);
        }
      }

      await loadStudents(token);

      setMessage(
        `Hoàn tất tạo GCN hàng loạt! Thành công: ${success}; thất bại: ${failed}.`
      );

      if (failedNames.length > 0) {
        setError(`Sinh viên tạo thất bại: ${failedNames.join(", ")}`);
      }
    } finally {
      setBulkGenerating(false);
      setBulkProgress("");
    }
  }

  // Cấp giấy chứng nhận thủ công
  async function handleIssue(item: Participant) {
    const number = certificateNumbers[item.id]?.trim();
    const file = certificateFiles[item.id];

    if (!number) {
      setError("Vui lòng nhập số giấy chứng nhận.");
      return;
    }

    if (!file) {
      setError("Vui lòng chọn file PDF giấy chứng nhận.");
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Chỉ chấp nhận file PDF.");
      return;
    }

    if (!window.confirm(`Xác nhận cấp giấy chứng nhận số ${number}?`)) {
      return;
    }

    setIssuingId(item.id);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("so_chung_nhan", number);

      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien/${item.id}/giay-chung-nhan`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Không cấp được giấy chứng nhận.");
      }

      setMessage("Đã cấp giấy chứng nhận thành công.");
      setCertificateFiles((prev) => ({ ...prev, [item.id]: null }));
      setCertificateNumbers((prev) => ({ ...prev, [item.id]: "" }));

      await loadStudents(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể cấp giấy chứng nhận."
      );
    } finally {
      setIssuingId("");
    }
  }

  // Xem giấy chứng nhận
  async function handleViewCertificate(item: Participant) {
    setError("");

    try {
      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien/${item.id}/giay-chung-nhan`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.signedUrl) {
        throw new Error(
          result.message || "Không lấy được file giấy chứng nhận."
        );
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể mở giấy chứng nhận."
      );
    }
  }

  // Thu hồi giấy chứng nhận
  async function handleRevoke(item: Participant) {
    const student = Array.isArray(item.students)
      ? item.students[0]
      : item.students;

    if (
      !window.confirm(
        `Bạn có chắc muốn thu hồi giấy chứng nhận của ${
          student?.ho_ten || "sinh viên này"
        }?`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/chuong-trinh/${programId}/sinh-vien/${item.id}/giay-chung-nhan`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Không thu hồi được giấy chứng nhận.");
      }

      setMessage("Đã thu hồi giấy chứng nhận.");
      await loadStudents(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể thu hồi giấy chứng nhận."
      );
    }
  }

  function handleExportExcel() {
    if (students.length === 0) {
      setError("Chưa có sinh viên để xuất Excel.");
      return;
    }

    const data = students.map((item, index) => {
      const student = Array.isArray(item.students)
        ? item.students[0]
        : item.students;

      return {
        STT: index + 1,
        MSSV: student?.mssv || "",
        "Họ và tên": student?.ho_ten || "",
        Lớp: student?.lop || "",
        "Ngày tham gia": item.ngay_tham_gia || "",
        "Số chứng nhận": item.certificate?.so_chung_nhan || "",
        "Trạng thái GCN": getCertificateStatus(item.certificate),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Danh sách sinh viên"
    );

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
    ];

    XLSX.writeFile(workbook, "DanhSachSinhVienThamGia.xlsx");
  }

  function getCertificateStatus(certificate: Certificate | null) {
    if (!certificate) return "Chưa cấp";

    if (
      ["da_thu_hoi", "đã thu hồi", "thu_hoi"].includes(
        certificate.trang_thai?.toLowerCase()
      )
    ) {
      return "Đã thu hồi";
    }

    if (
      ["da_phat_hanh", "đã phát hành"].includes(
        certificate.trang_thai?.toLowerCase()
      )
    ) {
      return "Đã cấp";
    }

    return "Đang chờ phát hành";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#f3f6fb",
        color: "#1e293b",
      }}
    >
      <button onClick={() => router.push("/admin")} style={buttonStyle}>
        ← Quay lại quản trị
      </button>

      <section style={sectionStyle}>
        <h1 style={{ color: "#174783" }}>
          Quản lý sinh viên tham gia
        </h1>

        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0, color: "#174783" }}>
            📥 Nhập danh sách sinh viên bằng Excel
          </h3>

          <p>
            File Excel cần có các cột: <b>MSSV</b>, <b>Họ và tên</b>,{" "}
            <b>Lớp</b>.
          </p>

          <p style={{ fontSize: 13, color: "#475569" }}>
            Sinh viên chưa có trong hệ thống sẽ được tạo hồ sơ mới.
            Sinh viên đã tham gia sẽ tự động được bỏ qua.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={saving || !token}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportExcel(file);
              e.target.value = "";
            }}
            style={{ display: "block", width: "100%", marginTop: 12 }}
          />

          {saving && (
            <p style={{ color: "#174783" }}>
              Đang xử lý danh sách, vui lòng chờ...
            </p>
          )}
        </div>

        <h3 style={{ color: "#174783" }}>
          Hoặc thêm sinh viên bằng MSSV
        </h3>

        <p>
          Dán danh sách MSSV vào ô bên dưới. Có thể nhập mỗi MSSV
          trên một dòng hoặc ngăn cách bằng dấu phẩy.
        </p>

        <textarea
          value={mssvList}
          onChange={(e) => setMssvList(e.target.value)}
          placeholder={"Ví dụ:\nTEST001\n22501001\n22501002"}
          rows={7}
          style={inputStyle}
        />

        <button
          onClick={handleAdd}
          disabled={saving || !token}
          style={{ ...buttonStyle, marginTop: 12 }}
        >
          {saving ? "Đang lưu..." : "Thêm sinh viên"}
        </button>

        {error && <p style={{ color: "#dc2626" }}>{error}</p>}
        {message && <p style={{ color: "#15803d" }}>{message}</p>}
      </section>

      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <h2 style={{ color: "#174783", margin: 0 }}>
            Danh sách tham gia ({students.length})
          </h2>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleBulkGenerate}
              disabled={loading || bulkGenerating || students.length === 0}
              style={{
                ...buttonStyle,
                background: "#7c3aed",
                opacity:
                  loading || bulkGenerating || students.length === 0
                    ? 0.5
                    : 1,
              }}
            >
              {bulkGenerating
                ? "Đang tạo hàng loạt..."
                : "✨ Tạo GCN hàng loạt"}
            </button>

            <button
              onClick={handleExportExcel}
              disabled={loading || students.length === 0}
              style={{
                ...buttonStyle,
                background: "#15803d",
                opacity: loading || students.length === 0 ? 0.5 : 1,
              }}
            >
              ↓ Xuất Excel
            </button>
          </div>
        </div>

        {bulkGenerating && (
          <p
            style={{
              color: "#7c3aed",
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            ✨ {bulkProgress}
          </p>
        )}

        {loading ? (
          <p>Đang tải danh sách...</p>
        ) : students.length === 0 ? (
          <p>Chưa có sinh viên tham gia chương trình.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1100,
              }}
            >
              <thead>
                <tr style={{ background: "#eff6ff" }}>
                  <th style={cellStyle}>STT</th>
                  <th style={cellStyle}>MSSV</th>
                  <th style={cellStyle}>Họ tên</th>
                  <th style={cellStyle}>Lớp</th>
                  <th style={cellStyle}>Ngày tham gia</th>
                  <th style={cellStyle}>Trạng thái GCN</th>
                  <th style={cellStyle}>Số chứng nhận</th>
                  <th style={cellStyle}>Quản lý GCN</th>
                  <th style={cellStyle}>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {students.map((item, index) => {
                  const student = Array.isArray(item.students)
                    ? item.students[0]
                    : item.students;

                  const certificate = item.certificate;
                  const status = getCertificateStatus(certificate);
                  const isIssued = status === "Đã cấp";
                  const isRevoked = status === "Đã thu hồi";

                  return (
                    <tr key={item.id}>
                      <td style={cellStyle}>{index + 1}</td>
                      <td style={cellStyle}>{student?.mssv || "—"}</td>
                      <td style={cellStyle}>{student?.ho_ten || "—"}</td>
                      <td style={cellStyle}>{student?.lop || "—"}</td>
                      <td style={cellStyle}>{item.ngay_tham_gia || "—"}</td>

                      <td style={cellStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "5px 9px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            color: isIssued
                              ? "#166534"
                              : isRevoked
                              ? "#991b1b"
                              : "#92400e",
                            background: isIssued
                              ? "#dcfce7"
                              : isRevoked
                              ? "#fee2e2"
                              : "#fef3c7",
                          }}
                        >
                          {status}
                        </span>
                      </td>

                      <td style={cellStyle}>
                        {certificate?.so_chung_nhan || "—"}
                      </td>

                      <td style={{ ...cellStyle, minWidth: 230 }}>
                        {isIssued ? (
                          <div style={{ display: "grid", gap: 7 }}>
                            <button
                              onClick={() => handleViewCertificate(item)}
                              style={{
                                ...buttonStyle,
                                background: "#2563eb",
                                padding: "7px 10px",
                              }}
                            >
                              Xem GCN
                            </button>

                            <button
                              onClick={() => handleRevoke(item)}
                              style={{
                                ...buttonStyle,
                                background: "#dc2626",
                                padding: "7px 10px",
                              }}
                            >
                              Thu hồi GCN
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 7 }}>
                            <button
                              onClick={() => handleAutoGenerate(item)}
                              disabled={issuingId === item.id || bulkGenerating}
                              style={{
                                ...buttonStyle,
                                background: "#7c3aed",
                                padding: "8px 10px",
                                opacity:
                                  issuingId === item.id || bulkGenerating
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {issuingId === item.id
                                ? "Đang tạo GCN..."
                                : "✨ Tạo GCN tự động"}
                            </button>

                            {isRevoked && (
                              <p
                                style={{
                                  color: "#991b1b",
                                  fontSize: 12,
                                  margin: 0,
                                }}
                              >
                                GCN trước đó đã bị thu hồi.
                              </p>
                            )}

                            <input
                              type="text"
                              value={certificateNumbers[item.id] || ""}
                              onChange={(e) =>
                                setCertificateNumbers((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="Số giấy chứng nhận"
                              style={smallInputStyle}
                            />

                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={(e) =>
                                setCertificateFiles((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.files?.[0] || null,
                                }))
                              }
                              style={{ width: "100%", fontSize: 12 }}
                            />

                            <button
                              onClick={() => handleIssue(item)}
                              disabled={issuingId === item.id || bulkGenerating}
                              style={{
                                ...buttonStyle,
                                background: "#15803d",
                                padding: "8px 10px",
                                opacity:
                                  issuingId === item.id || bulkGenerating
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {issuingId === item.id
                                ? "Đang cấp..."
                                : "Cấp GCN thủ công"}
                            </button>
                          </div>
                        )}
                      </td>

                      <td style={cellStyle}>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={bulkGenerating}
                          style={{
                            ...buttonStyle,
                            background: "#dc2626",
                            padding: "7px 12px",
                            opacity: bulkGenerating ? 0.5 : 1,
                          }}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function ProgramStudentsPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 40 }}>
          Đang tải trang...
        </main>
      }
    >
      <ProgramStudentsContent />
    </Suspense>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 14,
  marginTop: 20,
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

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  font: "inherit",
};

const smallInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 12,
};

const cellStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  verticalAlign: "top",
};
