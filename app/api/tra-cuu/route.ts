
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mssv =
      typeof body.mssv === "string" ? body.mssv.trim() : "";

    if (!mssv || mssv.length > 30) {
      return NextResponse.json(
        { message: "Vui lòng nhập MSSV hợp lệ." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !secretKey) {
        console.log("Kiểm tra cấu hình:", {
  coUrl: Boolean(supabaseUrl),
  coSecretKey: Boolean(secretKey),
});
      console.error("Thiếu cấu hình Supabase phía máy chủ.");
      return NextResponse.json(
        { message: "Hệ thống chưa được cấu hình đầy đủ." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, ho_ten, lop")
      .eq("mssv", mssv)
      .maybeSingle();

    if (studentError) {
      console.error("Lỗi tra cứu sinh viên:", studentError.message);
      return NextResponse.json(
        { message: "Không thể tra cứu lúc này. Vui lòng thử lại sau." },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { message: "Không tìm thấy thông tin sinh viên." },
        { status: 404 }
      );
    }

    const { data: participants, error: participantError } =
      await supabase
        .from("danhsachsinhvienthamgiachuongtrinh")
        .select(
          "id, ngay_tham_gia, quanlycacchuongtrinhdoanhoi(ten_chuong_trinh, ngay_bat_dau, ngay_ket_thuc, don_vi_to_chuc)"
        )
        .eq("student_id", student.id);

    if (participantError) {
      console.error(
        "Lỗi tra cứu chương trình:",
        participantError.message
      );
      return NextResponse.json(
        { message: "Không thể tải danh sách chương trình." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      student: {
        ho_ten: student.ho_ten,
        lop: student.lop,
      },
      programs: participants ?? [],
    });
  } catch {
    return NextResponse.json(
      { message: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 }
    );
  }
}
