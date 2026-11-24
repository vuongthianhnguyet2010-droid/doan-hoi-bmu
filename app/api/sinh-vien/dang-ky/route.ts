import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const body = await request.json();

    const hoTen = String(body.ho_ten || "").trim();
    const mssv = String(body.mssv || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = body.password;

    if (!hoTen || !mssv || !email || !password) {
      return NextResponse.json(
        { message: "Vui lòng nhập đầy đủ thông tin." },
        { status: 400 }
      );
    }

    if (!email.endsWith("@bmu.edu.vn")) {
      return NextResponse.json(
        { message: "Chỉ chấp nhận email có đuôi @bmu.edu.vn." },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { message: "Mật khẩu phải có ít nhất 8 ký tự." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !publishableKey || !secretKey) {
      throw new Error("Thiếu cấu hình Supabase.");
    }

    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Kiểm tra MSSV đã tồn tại
    const { data: existingMssv, error: mssvError } =
      await adminClient
        .from("students")
        .select("id")
        .eq("mssv", mssv)
        .maybeSingle();

    if (mssvError) {
      throw new Error("Không thể kiểm tra MSSV.");
    }

    if (existingMssv) {
      return NextResponse.json(
        { message: "MSSV này đã được đăng ký." },
        { status: 409 }
      );
    }

    // Kiểm tra email đã có hồ sơ
    const { data: existingEmail, error: emailError } =
      await adminClient
        .from("students")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (emailError) {
      throw new Error("Không thể kiểm tra email.");
    }

    if (existingEmail) {
      return NextResponse.json(
        { message: "Email này đã được sử dụng." },
        { status: 409 }
      );
    }

    // Tạo tài khoản Supabase Auth
    const authClient = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            mssv,
            ho_ten: hoTen,
            account_type: "student",
          },
        },
      });

    if (authError) {
      return NextResponse.json(
        { message: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { message: "Không thể tạo tài khoản." },
        { status: 400 }
      );
    }

    // Chặn trường hợp email đã có tài khoản Auth
    if (
      authData.user.identities &&
      authData.user.identities.length === 0
    ) {
      return NextResponse.json(
        { message: "Email này đã được đăng ký tài khoản." },
        { status: 409 }
      );
    }

    createdUserId = authData.user.id;

    // Tạo hồ sơ sinh viên mới
    const { error: insertError } = await adminClient
      .from("students")
      .insert({
        mssv,
        ho_ten: hoTen,
        email,
        auth_user_id: createdUserId,
      });

    if (insertError) {
      // Nếu tạo hồ sơ thất bại, xóa tài khoản Auth vừa tạo
      await adminClient.auth.admin.deleteUser(createdUserId);

      console.error("Lỗi tạo hồ sơ sinh viên:", insertError);

      return NextResponse.json(
        { message: "Không thể tạo hồ sơ sinh viên." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email BMU để xác minh tài khoản.",
    });
  } catch (error) {
    console.error("Lỗi đăng ký sinh viên:", error);

    if (createdUserId) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY;

      if (url && secretKey) {
        const adminClient = createClient(url, secretKey);
        await adminClient.auth.admin.deleteUser(createdUserId);
      }
    }

    return NextResponse.json(
      { message: "Lỗi máy chủ. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}