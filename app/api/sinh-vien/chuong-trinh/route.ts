
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;

    const authClient = createClient(url, publishableKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { message: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      );
    }

    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    const { data: participations, error: participationError } =
      await adminClient
        .from("danhsachsinhvienthamgiachuongtrinh")
        .select("id, program_id, ngay_tham_gia")
        .eq("student_id", student.id)
        .order("ngay_tham_gia", { ascending: false });

    if (participationError) {
      return NextResponse.json(
        { message: "Không thể tải danh sách chương trình." },
        { status: 500 }
      );
    }

    const programIds = [
      ...new Set((participations || []).map((item) => item.program_id)),
    ];

    if (programIds.length === 0) {
      return NextResponse.json({
        success: true,
        programs: [],
      });
    }

    const participantIds = (participations || []).map((item) => item.id);

    const [
      { data: programs, error: programError },
      { data: certificates, error: certificateError },
    ] = await Promise.all([
      adminClient
        .from("quanlycacchuongtrinhdoanhoi")
        .select(
          "id, ten_chuong_trinh, mo_ta, ngay_bat_dau, ngay_ket_thuc, don_vi_to_chuc"
        )
        .in("id", programIds),

      adminClient
        .from("giaychungnhan")
        .select(
          "id, participant_id, so_chung_nhan, file_url, trang_thai, ngay_phat_hanh"
        )
        .in("participant_id", participantIds),
    ]);

    if (programError || certificateError) {
      console.error("Lỗi tải chương trình/GCN:", {
        programError,
        certificateError,
      });

      return NextResponse.json(
        { message: "Không thể tải thông tin chương trình hoặc giấy chứng nhận." },
        { status: 500 }
      );
    }

    const result = (participations || []).map((item) => {
      const certificate =
        certificates?.find((cert) => cert.participant_id === item.id) || null;

      return {
        ...item,
        program:
          programs?.find((program) => program.id === item.program_id) || null,
        certificate,
        trang_thai_gcn: certificate?.trang_thai || "chua_phat_hanh",
      };
    });

    return NextResponse.json({
      success: true,
      programs: result,
    });
  } catch (error) {
    console.error("Lỗi lấy chương trình sinh viên:", error);

    return NextResponse.json(
      { message: "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
