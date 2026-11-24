
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const authClient = createClient(supabaseUrl, publishableKey);

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const BUCKET = "giay-chung-nhan";

async function checkAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice(7);
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) return false;

  const { data: admin, error: adminError } = await adminClient
    .from("quantrivien")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  return !adminError && !!admin;
}

// Phát hành giấy chứng nhận
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; participantId: string }>;
  }
) {
  let uploadedPath = "";

  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    const { id: programId, participantId } = await context.params;

    const formData = await request.formData();
    const file = formData.get("file");
    const soChungNhan = String(
      formData.get("so_chung_nhan") || ""
    ).trim();

    if (!soChungNhan) {
      return NextResponse.json(
        { message: "Vui lòng nhập số giấy chứng nhận." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Vui lòng chọn file PDF." },
        { status: 400 }
      );
    }

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { message: "Chỉ chấp nhận file PDF." },
        { status: 400 }
      );
    }

    

    // Kiểm tra sinh viên có thuộc chương trình này không
    const { data: participant, error: participantError } =
      await adminClient
        .from("danhsachsinhvienthamgiachuongtrinh")
        .select("id")
        .eq("id", participantId)
        .eq("program_id", programId)
        .maybeSingle();

    if (participantError || !participant) {
      return NextResponse.json(
        { message: "Không tìm thấy sinh viên trong chương trình." },
        { status: 404 }
      );
    }

    // Kiểm tra số GCN đã được sử dụng chưa
    const { data: duplicate, error: duplicateError } =
      await adminClient
        .from("giaychungnhan")
        .select("id")
        .eq("so_chung_nhan", soChungNhan)
        .neq("participant_id", participantId)
        .maybeSingle();

    if (duplicateError) throw duplicateError;

    if (duplicate) {
      return NextResponse.json(
        { message: "Số giấy chứng nhận này đã được sử dụng." },
        { status: 409 }
      );
    }

    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    uploadedPath =
      `${programId}/${participantId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(uploadedPath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Kiểm tra GCN cũ
    const { data: existing, error: existingError } =
      await adminClient
        .from("giaychungnhan")
        .select("id, file_url")
        .eq("participant_id", participantId)
        .maybeSingle();

    if (existingError) throw existingError;

    const certificateData = {
      participant_id: participantId,
      so_chung_nhan: soChungNhan,
      file_url: uploadedPath,
      trang_thai: "da_phat_hanh",
      ngay_phat_hanh: new Date().toISOString().slice(0, 10),
    };

    let saveError;

    if (existing) {
      const result = await adminClient
        .from("giaychungnhan")
        .update(certificateData)
        .eq("id", existing.id);

      saveError = result.error;
    } else {
      const result = await adminClient
        .from("giaychungnhan")
        .insert(certificateData);

      saveError = result.error;
    }

    if (saveError) throw saveError;

    // Xóa file cũ sau khi cập nhật thành công
    if (
      existing?.file_url &&
      existing.file_url !== uploadedPath
    ) {
      await adminClient.storage
        .from(BUCKET)
        .remove([existing.file_url]);
    }

    return NextResponse.json({
      message: "Phát hành giấy chứng nhận thành công.",
    });
  } catch (error) {
    console.error("Issue certificate error:", error);

    if (uploadedPath) {
      await adminClient.storage
        .from(BUCKET)
        .remove([uploadedPath]);
    }

    return NextResponse.json(
      { message: "Không thể phát hành giấy chứng nhận." },
      { status: 500 }
    );
  }
}

// Thu hồi giấy chứng nhận
export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; participantId: string }>;
  }
) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    const { id: programId, participantId } = await context.params;

    const { data: participant } = await adminClient
      .from("danhsachsinhvienthamgiachuongtrinh")
      .select("id")
      .eq("id", participantId)
      .eq("program_id", programId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json(
        { message: "Không tìm thấy sinh viên trong chương trình." },
        { status: 404 }
      );
    }

    const { data, error } = await adminClient
      .from("giaychungnhan")
      .update({ trang_thai: "da_thu_hoi" })
      .eq("participant_id", participantId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { message: "Sinh viên chưa có giấy chứng nhận." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Đã thu hồi giấy chứng nhận.",
    });
  } catch (error) {
    console.error("Revoke certificate error:", error);

    return NextResponse.json(
      { message: "Không thể thu hồi giấy chứng nhận." },
      { status: 500 }
    );
  }
}

// Tạo đường dẫn xem PDF có thời hạn
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; participantId: string }>;
  }
) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    const { id: programId, participantId } = await context.params;

    const { data: participant } = await adminClient
      .from("danhsachsinhvienthamgiachuongtrinh")
      .select("id")
      .eq("id", participantId)
      .eq("program_id", programId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json(
        { message: "Không tìm thấy sinh viên." },
        { status: 404 }
      );
    }

    const { data: certificate, error } = await adminClient
      .from("giaychungnhan")
      .select("*")
      .eq("participant_id", participantId)
      .maybeSingle();

    if (error) throw error;

    if (!certificate) {
      return NextResponse.json(
        { message: "Chưa có giấy chứng nhận." },
        { status: 404 }
      );
    }

    let signedUrl = null;

    if (certificate.file_url) {
      const { data: signed, error: signedError } =
        await adminClient.storage
          .from(BUCKET)
          .createSignedUrl(certificate.file_url, 300);

      if (signedError) throw signedError;

      signedUrl = signed.signedUrl;
    }

    return NextResponse.json({
      certificate,
      signedUrl,
    });
  } catch (error) {
    console.error("Get certificate error:", error);

    return NextResponse.json(
      { message: "Không thể tải giấy chứng nhận." },
      { status: 500 }
    );
  }
}
