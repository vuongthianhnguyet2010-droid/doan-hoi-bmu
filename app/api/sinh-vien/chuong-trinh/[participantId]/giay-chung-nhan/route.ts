
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const authClient = createClient(supabaseUrl, publishableKey);
const adminClient = createClient(supabaseUrl, secretKey);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { message: "Chưa đăng nhập." },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { message: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      );
    }

    const { participantId } = await context.params;

    // Tìm hồ sơ sinh viên đang đăng nhập
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { message: "Không tìm thấy hồ sơ sinh viên." },
        { status: 404 }
      );
    }

    // Kiểm tra chương trình có thuộc sinh viên này không
    const { data: participant, error: participantError } =
      await adminClient
        .from("danhsachsinhvienthamgiachuongtrinh")
        .select("id")
        .eq("id", participantId)
        .eq("student_id", student.id)
        .maybeSingle();

    if (participantError || !participant) {
      return NextResponse.json(
        { message: "Bạn không có quyền xem giấy chứng nhận này." },
        { status: 403 }
      );
    }

    // Lấy giấy chứng nhận đã phát hành
    const { data: certificate, error: certificateError } =
      await adminClient
        .from("giaychungnhan")
        .select("file_url, trang_thai")
        .eq("participant_id", participantId)
        .maybeSingle();

    if (certificateError || !certificate) {
      return NextResponse.json(
        { message: "Chưa tìm thấy giấy chứng nhận." },
        { status: 404 }
      );
    }

    if (
      !["da_phat_hanh", "đã phát hành"].includes(
        (certificate.trang_thai || "").toLowerCase().trim()
      )
    ) {
      return NextResponse.json(
        { message: "Giấy chứng nhận chưa được phát hành hoặc đã thu hồi." },
        { status: 403 }
      );
    }

    if (!certificate.file_url) {
      return NextResponse.json(
        { message: "Không tìm thấy file giấy chứng nhận." },
        { status: 404 }
      );
    }

    // Tạo link xem PDF có hiệu lực 5 phút
    const { data: signedData, error: signedError } =
      await adminClient.storage
        .from("giay-chung-nhan")
        .createSignedUrl(certificate.file_url, 300);

    if (signedError || !signedData?.signedUrl) {
      console.error("SIGNED URL ERROR:", signedError);

      return NextResponse.json(
        { message: "Không thể tạo liên kết xem giấy chứng nhận." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
    });
  } catch (error) {
    console.error("STUDENT CERTIFICATE ERROR:", error);

    return NextResponse.json(
      { message: "Đã xảy ra lỗi máy chủ." },
      { status: 500 }
    );
  }
}
