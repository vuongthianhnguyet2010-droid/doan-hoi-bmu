
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "crypto";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const BUCKET = "giay-chung-nhan";

const authClient = createClient(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: "Bạn chưa đăng nhập.", status: 401 };
  }

  const { data: userData, error: userError } =
    await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "Phiên đăng nhập không hợp lệ.", status: 401 };
  }

  const { data: admin, error } = await adminClient
    .from("quantrivien")
    .select("id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error || !admin) {
    return {
      error: "Bạn không có quyền thực hiện chức năng này.",
      status: 403,
    };
  }

  return { user: userData.user };
}

function normalizeMssv(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function getStudent(item: any) {
  return Array.isArray(item.students)
    ? item.students[0]
    : item.students;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin(request);

  if ("error" in auth) {
    return NextResponse.json(
      { message: auth.error },
      { status: auth.status }
    );
  }

  const { id: programId } = await params;

  try {
    const body = await request.json();
    const action = body.action;

    // BƯỚC 1: Tạo đường dẫn upload PDF gốc
    if (action === "prepare") {
      const fileName = String(body.fileName || "");

      if (!fileName.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json(
          { message: "Chỉ chấp nhận file PDF." },
          { status: 400 }
        );
      }

      const tempPath = `_bulk-temp/${programId}/${randomUUID()}.pdf`;

      const { data, error } = await adminClient.storage
        .from(BUCKET)
        .createSignedUploadUrl(tempPath);

      if (error || !data) {
        return NextResponse.json(
          {
            message:
              error?.message || "Không tạo được đường dẫn upload.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        path: data.path,
        token: data.token,
      });
    }

    // BƯỚC 2: Tách PDF và cấp giấy chứng nhận
    if (action === "issue") {
      const tempPath = String(body.tempPath || "");
      const rawMssvs = body.mssvs;

      if (
        !tempPath.startsWith(`_bulk-temp/${programId}/`) ||
        !tempPath.toLowerCase().endsWith(".pdf")
      ) {
        return NextResponse.json(
          { message: "Đường dẫn file PDF không hợp lệ." },
          { status: 400 }
        );
      }

      if (
        !Array.isArray(rawMssvs) ||
        rawMssvs.length === 0 ||
        rawMssvs.some((value) => !normalizeMssv(value))
      ) {
        return NextResponse.json(
          { message: "Danh sách MSSV không hợp lệ." },
          { status: 400 }
        );
      }

      const mssvs = rawMssvs.map(normalizeMssv);

      if (new Set(mssvs).size !== mssvs.length) {
        return NextResponse.json(
          { message: "Danh sách Excel có MSSV bị trùng." },
          { status: 400 }
        );
      }

      // Kiểm tra chương trình
      const { data: program, error: programError } =
        await adminClient
          .from("quanlycacchuongtrinhdoanhoi")
          .select("id")
          .eq("id", programId)
          .maybeSingle();

      if (programError || !program) {
        return NextResponse.json(
          { message: "Không tìm thấy chương trình." },
          { status: 404 }
        );
      }

      // Tải PDF gốc từ Storage
      const { data: pdfFile, error: downloadError } =
        await adminClient.storage
          .from(BUCKET)
          .download(tempPath);

      if (downloadError || !pdfFile) {
        return NextResponse.json(
          { message: "Không tải được file PDF gốc." },
          { status: 400 }
        );
      }

      const pdfBytes = await pdfFile.arrayBuffer();
      const sourcePdf = await PDFDocument.load(pdfBytes);
      const pageCount = sourcePdf.getPageCount();

      if (pageCount !== mssvs.length) {
        return NextResponse.json(
          {
            message: `PDF có ${pageCount} trang nhưng Excel có ${mssvs.length} MSSV. Hai số lượng phải bằng nhau.`,
            pageCount,
            studentCount: mssvs.length,
          },
          { status: 400 }
        );
      }

      // Lấy danh sách sinh viên tham gia chương trình
      const { data: participants, error: participantError } =
        await adminClient
          .from("danhsachsinhvienthamgiachuongtrinh")
          .select("id, student_id, students(id, mssv, ho_ten, lop)")
          .eq("program_id", programId);

      if (participantError) {
        return NextResponse.json(
          { message: participantError.message },
          { status: 500 }
        );
      }

      const participantMap = new Map<string, any>();

      (participants || []).forEach((item: any) => {
        const student = getStudent(item);
        const mssv = normalizeMssv(student?.mssv);

        if (mssv) {
          participantMap.set(mssv, {
            ...item,
            student,
          });
        }
      });

      const missingMssvs = mssvs.filter(
        (mssv) => !participantMap.has(mssv)
      );

      if (missingMssvs.length > 0) {
        return NextResponse.json(
          {
            message:
              "Có MSSV không thuộc danh sách tham gia chương trình.",
            missingMssvs,
          },
          { status: 400 }
        );
      }

      const participantIds = mssvs.map(
        (mssv) => participantMap.get(mssv).id
      );

      // Kiểm tra những sinh viên đã có GCN
      const { data: existingCertificates, error: certError } =
        await adminClient
          .from("giaychungnhan")
          .select("participant_id")
          .in("participant_id", participantIds);

      if (certError) {
        return NextResponse.json(
          { message: certError.message },
          { status: 500 }
        );
      }

      const existingIds = new Set(
        (existingCertificates || []).map(
          (item) => item.participant_id
        )
      );

      const skipped: string[] = [];
      const issued: any[] = [];
      const failed: any[] = [];

      const year = new Date().getFullYear();

      // Tách và upload từng trang PDF
      for (let index = 0; index < mssvs.length; index++) {
        const mssv = mssvs[index];
        const participant = participantMap.get(mssv);

        if (existingIds.has(participant.id)) {
          skipped.push(mssv);
          continue;
        }

        let uploadedPath = "";

        try {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(
            sourcePdf,
            [index]
          );

          newPdf.addPage(copiedPage);

          const pageBytes = await newPdf.save();
          const certificateNumber =
            `BMU-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;

          const filePath =
            `${programId}/${participant.id}/${Date.now()}-${randomUUID()}.pdf`;

          const { error: uploadError } = await adminClient.storage
            .from(BUCKET)
            .upload(filePath, pageBytes, {
              contentType: "application/pdf",
              upsert: false,
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          uploadedPath = filePath;

          const { error: insertError } = await adminClient
            .from("giaychungnhan")
            .insert({
              participant_id: participant.id,
              so_chung_nhan: certificateNumber,
              file_url: filePath,
              trang_thai: "da_phat_hanh",
              ngay_phat_hanh: new Date().toISOString(),
            });

          if (insertError) {
            throw new Error(insertError.message);
          }

          issued.push({
            mssv,
            ho_ten: participant.student?.ho_ten || "",
            so_chung_nhan: certificateNumber,
          });
        } catch (error) {
          if (uploadedPath) {
            await adminClient.storage
              .from(BUCKET)
              .remove([uploadedPath]);
          }

          failed.push({
            mssv,
            message:
              error instanceof Error
                ? error.message
                : "Không thể cấp GCN.",
          });
        }
      }

      // Xóa file PDF gốc sau khi xử lý
      await adminClient.storage
        .from(BUCKET)
        .remove([tempPath]);

      return NextResponse.json({
        success: true,
        message: "Đã xử lý cấp GCN hàng loạt.",
        totalPages: pageCount,
        issued,
        skipped,
        failed,
      });
    }

    return NextResponse.json(
      { message: "Thao tác không hợp lệ." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Đã xảy ra lỗi khi xử lý PDF.",
      },
      { status: 500 }
    );
  }
}
