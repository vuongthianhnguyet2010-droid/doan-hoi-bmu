
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const body = await request.json();

    const hoTen = String(body.ho_ten || "").trim();
    const mssv = String(body.mssv || "").trim().toUpperCase();
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
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
      throw new Error("Thiếu cấu hình Supabase.");
    }

    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Kiểm tra hồ sơ sinh viên theo MSSV
    const { data: existingStudent, error: studentError } =
      await adminClient
        .from("students")
        .select("id, mssv, ho_ten, email, auth_user_id")
        .eq("mssv", mssv)
        .maybeSingle();

    if (studentError) {
      console.error("Lỗi kiểm tra MSSV:", studentError);
      throw new Error("Không thể kiểm tra MSSV.");
    }

    // MSSV đã liên kết tài khoản
    if (existingStudent?.auth_user_id) {
      return NextResponse.json(
        { message: "MSSV này đã được đăng ký tài khoản." },
        { status: 409 }
      );
    }

    // Kiểm tra email có thuộc hồ sơ sinh viên khác không
    const { data: existingEmail, error: emailError } =
      await adminClient
        .from("students")
        .select("id, mssv, auth_user_id")
        .eq("email", email)
        .maybeSingle();

    if (emailError) {
      console.error("Lỗi kiểm tra email:", emailError);
      throw new Error("Không thể kiểm tra email.");
    }

    if (existingEmail && existingEmail.mssv !== mssv) {
      return NextResponse.json(
        { message: "Email này đã được sử dụng." },
        { status: 409 }
      );
    }

    // Tạo tài khoản Supabase Auth
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          mssv,
          ho_ten: hoTen,
          account_type: "student",
        },
      });

    if (authError) {
      console.error("LỖI SUPABASE AUTH:", authError);

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

    createdUserId = authData.user.id;

    // Nếu hồ sơ đã tồn tại nhưng chưa có tài khoản
    // thì cập nhật hồ sơ cũ, không tạo hồ sơ trùng
    if (existingStudent) {
      const { error: updateError } = await adminClient
        .from("students")
        .update({
          ho_ten: hoTen,
          email,
          auth_user_id: createdUserId,
        })
        .eq("id", existingStudent.id);

      if (updateError) {
        console.error("Lỗi cập nhật hồ sơ:", updateError);

        await adminClient.auth.admin.deleteUser(createdUserId);
        createdUserId = null;

        return NextResponse.json(
          { message: "Không thể liên kết tài khoản với hồ sơ sinh viên." },
          { status: 500 }
        );
      }
    } else {
      // Nếu MSSV chưa có hồ sơ thì tạo hồ sơ mới
      const { error: insertError } = await adminClient
        .from("students")
        .insert({
          mssv,
          ho_ten: hoTen,
          email,
          auth_user_id: createdUserId,
        });

      if (insertError) {
        console.error("Lỗi tạo hồ sơ sinh viên:", insertError);

        await adminClient.auth.admin.deleteUser(createdUserId);
        createdUserId = null;

        return NextResponse.json(
          { message: "Không thể tạo hồ sơ sinh viên." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay.",
    });
  } catch (error) {
    console.error("Lỗi đăng ký sinh viên:", error);

    // Xóa tài khoản Auth nếu quá trình xử lý gặp lỗi
    if (createdUserId) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY;

      if (url && secretKey) {
        const adminClient = createClient(url, secretKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        await adminClient.auth.admin.deleteUser(createdUserId);
      }
    }

    return NextResponse.json(
      { message: "Lỗi máy chủ. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
