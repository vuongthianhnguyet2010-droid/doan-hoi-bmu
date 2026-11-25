
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function getAdmin(request: Request) {
  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const secretKey = process.env.SUPABASE_SECRET_KEY!;

  const authClient = createClient(url, publishableKey);
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) return null;

  const adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: admin } = await adminClient
    .from("quantrivien")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  return admin ? adminClient : null;
}

// Lấy danh sách chương trình kèm số lượng sinh viên
export async function GET(request: Request) {
  const supabase = await getAdmin(request);

  if (!supabase) {
    return NextResponse.json(
      { message: "Không có quyền quản trị." },
      { status: 403 }
    );
  }

  const { data: programs, error } = await supabase
    .from("quanlycacchuongtrinhdoanhoi")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }

  const { data: participants, error: participantError } = await supabase
    .from("danhsachsinhvienthamgiachuongtrinh")
    .select("program_id");

  if (participantError) {
    return NextResponse.json(
      { message: participantError.message },
      { status: 500 }
    );
  }

  const counts: Record<string, number> = {};

  for (const item of participants || []) {
    counts[item.program_id] = (counts[item.program_id] || 0) + 1;
  }

  const result = (programs || []).map((program) => ({
    ...program,
    so_luong_sinh_vien: counts[program.id] || 0,
  }));

  return NextResponse.json({ programs: result });
}

// Thêm chương trình
export async function POST(request: Request) {
  const supabase = await getAdmin(request);

  if (!supabase) {
    return NextResponse.json(
      { message: "Không có quyền quản trị." },
      { status: 403 }
    );
  }

  const body = await request.json();

  if (!body.ten_chuong_trinh?.trim()) {
    return NextResponse.json(
      { message: "Vui lòng nhập tên chương trình." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("quanlycacchuongtrinhdoanhoi")
    .insert({
      ten_chuong_trinh: body.ten_chuong_trinh.trim(),
      mo_ta: body.mo_ta || null,
      ngay_bat_dau: body.ngay_bat_dau || null,
      ngay_ket_thuc: body.ngay_ket_thuc || null,
      don_vi_to_chuc: body.don_vi_to_chuc || null,
      so_quyet_dinh: body.so_quyet_dinh?.trim() || null,
      trang_thai: "draft",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ program: data });
}

// Cập nhật chương trình
export async function PATCH(request: Request) {
  const supabase = await getAdmin(request);

  if (!supabase) {
    return NextResponse.json(
      { message: "Không có quyền quản trị." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { message: "Thiếu ID chương trình." },
      { status: 400 }
    );
  }

  const allowedFields = [
    "ten_chuong_trinh",
    "mo_ta",
    "ngay_bat_dau",
    "ngay_ket_thuc",
    "don_vi_to_chuc",
    "so_quyet_dinh",
    "trang_thai",
  ];

  const cleanUpdates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in updates) {
      cleanUpdates[field] =
        field === "so_quyet_dinh" && typeof updates[field] === "string"
          ? updates[field].trim() || null
          : updates[field];
    }
  }

  const { data, error } = await supabase
    .from("quanlycacchuongtrinhdoanhoi")
    .update(cleanUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ program: data });
}
