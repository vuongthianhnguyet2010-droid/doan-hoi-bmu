
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

async function checkAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

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

// Lấy danh sách sinh viên tham gia và thông tin giấy chứng nhận
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    const { id: programId } = await context.params;

    const { data, error } = await adminClient
      .from("danhsachsinhvienthamgiachuongtrinh")
      .select(`
        id,
        student_id,
        ngay_tham_gia,
        students (
          id,
          mssv,
          ho_ten,
          lop
        )
      `)
      .eq("program_id", programId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const participants = data || [];

    // Nếu chương trình chưa có sinh viên thì trả danh sách rỗng
    if (participants.length === 0) {
      return NextResponse.json({ participants: [] });
    }

    // Lấy danh sách ID lượt tham gia
    const participantIds = participants.map((item) => item.id);

    // Lấy thông tin giấy chứng nhận tương ứng
    const { data: certificates, error: certificateError } = await adminClient
      .from("giaychungnhan")
      .select(`
        id,
        participant_id,
        so_chung_nhan,
        file_url,
        trang_thai,
        ngay_phat_hanh,
        created_at
      `)
      .in("participant_id", participantIds)
      .order("created_at", { ascending: false });

    if (certificateError) throw certificateError;

    // Ghép giấy chứng nhận vào từng sinh viên
    const certificateMap = new Map<string, (typeof certificates)[number]>();

    (certificates || []).forEach((certificate) => {
      if (
        certificate.participant_id &&
        !certificateMap.has(certificate.participant_id)
      ) {
        certificateMap.set(certificate.participant_id, certificate);
      }
    });

    const result = participants.map((participant) => ({
      ...participant,
      certificate: certificateMap.get(participant.id) || null,
    }));

    return NextResponse.json({
      participants: result,
    });
  } catch (error) {
    console.error("GET participants error:", error);

    return NextResponse.json(
      { message: "Không tải được danh sách sinh viên." },
      { status: 500 }
    );
  }
}

// Thêm sinh viên vào chương trình bằng MSSV hoặc danh sách Excel
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    const { id: programId } = await context.params;
    const body = await request.json();

    const { data: program, error: programError } = await adminClient
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

    let studentIds: string[] = [];
    let notFound: string[] = [];
    let created = 0;

    // Trường hợp import Excel: nhận MSSV, họ tên, lớp
    if (Array.isArray(body.students)) {
      const students = body.students
        .filter(
          (item: any) =>
            item &&
            typeof item.mssv === "string" &&
            typeof item.ho_ten === "string"
        )
        .map((item: any) => ({
          mssv: item.mssv.trim(),
          ho_ten: item.ho_ten.trim(),
          lop: typeof item.lop === "string" ? item.lop.trim() : null,
        }))
        .filter(
          (item: any) => item.mssv !== "" && item.ho_ten !== ""
        );

      const uniqueStudents = Array.from(
        new Map(students.map((item: any) => [item.mssv, item])).values()
      );

      if (uniqueStudents.length === 0) {
        return NextResponse.json(
          { message: "Danh sách Excel không có dữ liệu hợp lệ." },
          { status: 400 }
        );
      }

      const mssvs = uniqueStudents.map((item: any) => item.mssv);

      // Tìm sinh viên đã có trong hệ thống
      const { data: existingStudents, error: findError } = await adminClient
        .from("students")
        .select("id, mssv")
        .in("mssv", mssvs);

      if (findError) throw findError;

      const existingMssvs = new Set(
        (existingStudents || []).map((item) => item.mssv)
      );

      // Chỉ tạo những sinh viên chưa tồn tại
      const newStudents = uniqueStudents.filter(
        (item: any) => !existingMssvs.has(item.mssv)
      );

      if (newStudents.length > 0) {
        const { error: insertStudentError } = await adminClient
          .from("students")
          .insert(newStudents);

        if (insertStudentError) throw insertStudentError;

        created = newStudents.length;
      }

      // Lấy lại toàn bộ ID sinh viên
      const { data: allStudents, error: allStudentsError } =
        await adminClient
          .from("students")
          .select("id, mssv")
          .in("mssv", mssvs);

      if (allStudentsError) throw allStudentsError;

      const foundMssvs = new Set(
        (allStudents || []).map((item) => item.mssv)
      );

      notFound = mssvs.filter((mssv: string) => !foundMssvs.has(mssv));

      studentIds = (allStudents || []).map((item) => item.id);
    } else {
      // Giữ cách thêm sinh viên cũ bằng MSSV
      const mssvs = (Array.isArray(body.mssvs) ? body.mssvs : [])
        .filter((item: any) => typeof item === "string")
        .map((item: string) => item.trim())
        .filter((item: string) => item !== "")
        .filter(
          (item: string, index: number, arr: string[]) =>
            arr.indexOf(item) === index
        );

      if (mssvs.length === 0) {
        return NextResponse.json(
          { message: "Danh sách MSSV không hợp lệ." },
          { status: 400 }
        );
      }

      const { data: foundStudents, error: studentError } = await adminClient
        .from("students")
        .select("id, mssv")
        .in("mssv", mssvs);

      if (studentError) throw studentError;

      const foundMssvs = new Set(
        (foundStudents || []).map((item) => item.mssv)
      );

      notFound = mssvs.filter((mssv: string) => !foundMssvs.has(mssv));

      studentIds = (foundStudents || []).map((item) => item.id);
    }

    if (studentIds.length === 0) {
      return NextResponse.json({
        added: 0,
        created,
        notFound,
      });
    }

    // Kiểm tra sinh viên đã có trong chương trình chưa
    const { data: existing, error: existingError } = await adminClient
      .from("danhsachsinhvienthamgiachuongtrinh")
      .select("student_id")
      .eq("program_id", programId)
      .in("student_id", studentIds);

    if (existingError) throw existingError;

    const existingIds = new Set(
      (existing || []).map((item) => item.student_id)
    );

    const newIds = studentIds.filter((id) => !existingIds.has(id));

    // Thêm sinh viên vào chương trình
    if (newIds.length > 0) {
      const rows = newIds.map((studentId) => ({
        student_id: studentId,
        program_id: programId,
        ngay_tham_gia: new Date().toISOString().slice(0, 10),
      }));

      const { error: insertError } = await adminClient
        .from("danhsachsinhvienthamgiachuongtrinh")
        .insert(rows);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      added: newIds.length,
      created,
      notFound,
      skipped: studentIds.length - newIds.length,
    });
  } catch (error) {
    console.error("POST participants error:", error);

    return NextResponse.json(
      { message: "Không thể thêm sinh viên. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}

// Xóa sinh viên khỏi chương trình
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    const { id: programId } = await context.params;
    const body = await request.json();
    const participantId = body.participantId;

    if (!participantId) {
      return NextResponse.json(
        { message: "Thiếu thông tin sinh viên." },
        { status: 400 }
      );
    }

    const { data, error } = await adminClient
      .from("danhsachsinhvienthamgiachuongtrinh")
      .delete()
      .eq("id", participantId)
      .eq("program_id", programId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { message: "Không tìm thấy sinh viên trong chương trình." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Đã xóa sinh viên khỏi chương trình.",
    });
  } catch (error) {
    console.error("DELETE participant error:", error);

    return NextResponse.json(
      { message: "Không thể xóa sinh viên." },
      { status: 500 }
    );
  }
}
