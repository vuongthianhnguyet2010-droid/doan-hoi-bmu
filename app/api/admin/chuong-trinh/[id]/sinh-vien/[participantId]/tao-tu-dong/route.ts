
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const authClient = createClient(supabaseUrl, publishableKey);

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const BUCKET = "giay-chung-nhan";

const PAGE_WIDTH = 2000;
const PAGE_HEIGHT = 1414;

const BROWN = rgb(0.42, 0.18, 0.13);
const RED = rgb(0.87, 0.02, 0.15);

// ==========================================
// KIỂM TRA QUẢN TRỊ VIÊN
// ==========================================

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

// ==========================================
// VẼ TEXT
// ==========================================

function drawTextTop(
  page: any,
  text: string,
  font: any,
  size: number,
  top: number,
  color: any,
  x?: number
) {
  const width = font.widthOfTextAtSize(text, size);

  const drawX =
    x !== undefined ? x : (PAGE_WIDTH - width) / 2;

  page.drawText(text, {
    x: drawX,
    y: PAGE_HEIGHT - top - size,
    size,
    font,
    color,
  });
}

// ==========================================
// TEXT CĂN GIỮA VÀ TỰ THU NHỎ
// ==========================================

function drawCenteredFit(
  page: any,
  text: string,
  font: any,
  maxSize: number,
  minSize: number,
  top: number,
  maxWidth: number,
  color: any
) {
  let size = maxSize;

  while (
    size > minSize &&
    font.widthOfTextAtSize(text, size) > maxWidth
  ) {
    size -= 2;
  }

  drawTextTop(page, text, font, size, top, color);
}

// ==========================================
// TEXT CĂN GIỮA TRONG VÙNG
// ==========================================

function drawCenteredInArea(
  page: any,
  text: string,
  font: any,
  maxSize: number,
  minSize: number,
  top: number,
  areaX: number,
  areaWidth: number,
  color: any
) {
  let size = maxSize;

  while (
    size > minSize &&
    font.widthOfTextAtSize(text, size) > areaWidth
  ) {
    size -= 2;
  }

  const textWidth = font.widthOfTextAtSize(text, size);
  const x = areaX + (areaWidth - textWidth) / 2;

  drawTextTop(page, text, font, size, top, color, x);
}

// ==========================================
// VẼ LOGO GIỮ NGUYÊN TỶ LỆ
// ==========================================

function drawImageContain(
  page: any,
  image: any,
  boxX: number,
  boxTop: number,
  boxWidth: number,
  boxHeight: number
) {
  const imageWidth = image.width;
  const imageHeight = image.height;

  const scale = Math.min(
    boxWidth / imageWidth,
    boxHeight / imageHeight
  );

  const width = imageWidth * scale;
  const height = imageHeight * scale;

  const x = boxX + (boxWidth - width) / 2;

  const y =
    PAGE_HEIGHT -
    boxTop -
    boxHeight +
    (boxHeight - height) / 2;

  page.drawImage(image, {
    x,
    y,
    width,
    height,
  });
}

// ==========================================
// CHIA DÒNG
// ==========================================

function wrapText(
  text: string,
  font: any,
  size: number,
  maxWidth: number
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];

  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (
      font.widthOfTextAtSize(test, size) > maxWidth &&
      current
    ) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);

  return lines;
}

// ==========================================
// ĐỊNH DẠNG NGÀY
// ==========================================

function formatDate(date: Date) {
  return `${date.getDate()} tháng ${
    date.getMonth() + 1
  } năm ${date.getFullYear()}`;
}

function formatDateString(value: string | null | undefined) {
  if (!value) return "";

  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]} tháng ${parts[1]} năm ${parts[0]}`;
}

// ==========================================
// TẠO GCN TỰ ĐỘNG
// ==========================================

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

    const { id: programId, participantId } =
      await context.params;

    // ==========================================
    // LẤY THÔNG TIN SINH VIÊN
    // ==========================================

    const { data: participant, error: participantError } =
      await adminClient
        .from("danhsachsinhvienthamgiachuongtrinh")
        .select("id, student_id, program_id")
        .eq("id", participantId)
        .eq("program_id", programId)
        .maybeSingle();

    if (participantError || !participant) {
      return NextResponse.json(
        {
          message:
            "Không tìm thấy sinh viên trong chương trình.",
        },
        { status: 404 }
      );
    }

    const { data: student, error: studentError } =
      await adminClient
        .from("students")
        .select("id, ho_ten, lop, mssv")
        .eq("id", participant.student_id)
        .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { message: "Không tìm thấy thông tin sinh viên." },
        { status: 404 }
      );
    }

    // ==========================================
    // LẤY THÔNG TIN CHƯƠNG TRÌNH
    // ==========================================

    const { data: program, error: programError } =
      await adminClient
        .from("quanlycacchuongtrinhdoanhoi")
        .select("*")
        .eq("id", programId)
        .maybeSingle();

    if (programError || !program) {
      return NextResponse.json(
        { message: "Không tìm thấy chương trình." },
        { status: 404 }
      );
    }

    // ==========================================
    // XÁC ĐỊNH ĐƠN VỊ
    // ==========================================

    const donVi = String(program.don_vi_to_chuc || "")
      .trim()
      .toLowerCase();

    const isDoan = donVi.includes("đoàn");

    if (!isDoan && !donVi.includes("hội")) {
      throw new Error("Đơn vị tổ chức không hợp lệ.");
    }

    // ==========================================
    // KIỂM TRA GCN CŨ
    // ==========================================

    const { data: existing, error: existingError } =
      await adminClient
        .from("giaychungnhan")
        .select("id, file_url, so_chung_nhan, trang_thai")
        .eq("participant_id", participantId)
        .maybeSingle();

    if (existingError) throw existingError;

    // ==========================================
    // CẤP SỐ GCN
    // ==========================================

    let soChungNhan = existing?.so_chung_nhan || "";

    if (!soChungNhan) {
      const { data: counter, error: counterError } =
        await adminClient.rpc(
          "tang_so_giay_chung_nhan",
          { p_program_id: programId }
        );

      if (counterError) throw counterError;

      if (typeof counter !== "number") {
        throw new Error("Không lấy được số chứng nhận.");
      }

      soChungNhan = isDoan
        ? `${counter}-QĐ/ĐTN`
        : `${String(counter).padStart(3, "0")}-QĐ/HSV-${programId.slice(0, 6)}`;
    }

    // ==========================================
    // KIỂM TRA SỐ GCN TRÙNG
    // ==========================================

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
        { message: "Số chứng nhận đã được sử dụng." },
        { status: 409 }
      );
    }

    // ==========================================
    // ĐỌC FILE THEO ĐƠN VỊ
    // ==========================================

    const publicPath = path.join(process.cwd(), "public");
    const fontPath = path.join(publicPath, "fonts");

    const backgroundBytes = fs.readFileSync(
      path.join(
        publicPath,
        isDoan
          ? "mau-gcn-doan.png"
          : "mau-gcn-hoi-sinh-vien.png"
      )
    );

    const logoBMUBytes = fs.readFileSync(
      path.join(publicPath, "logo-bmu.png")
    );

    const logoDoanBytes = fs.readFileSync(
      path.join(publicPath, "logo-doan.png")
    );

    const logoHoiBytes = fs.readFileSync(
      path.join(publicPath, "logo-hoi-sinh-vien.png")
    );

    const timesRegularBytes = fs.readFileSync(
      path.join(fontPath, "times.ttf")
    );

    const timesItalicBytes = fs.readFileSync(
      path.join(fontPath, "timesi.ttf")
    );

    const timesBoldBytes = fs.readFileSync(
      path.join(fontPath, "timesbd.ttf")
    );

    const timesBoldItalicBytes = fs.readFileSync(
      path.join(fontPath, "timesbi.ttf")
    );

    // ==========================================
    // TẠO PDF
    // ==========================================

    const pdfDoc = await PDFDocument.create();

    pdfDoc.registerFontkit(fontkit);

    const timesRegular = await pdfDoc.embedFont(
      timesRegularBytes
    );

    const timesItalic = await pdfDoc.embedFont(
      timesItalicBytes
    );

    const timesBold = await pdfDoc.embedFont(
      timesBoldBytes
    );

    const timesBoldItalic = await pdfDoc.embedFont(
      timesBoldItalicBytes
    );

    const background = await pdfDoc.embedPng(
      backgroundBytes
    );

    const logoBMU = await pdfDoc.embedPng(
      logoBMUBytes
    );

    const logoDoan = await pdfDoc.embedPng(
      logoDoanBytes
    );

    const logoHoi = await pdfDoc.embedPng(
      logoHoiBytes
    );

    const page = pdfDoc.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

    // ==========================================
    // NỀN GCN
    // ==========================================

    page.drawImage(background, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });

    // ==========================================
    // NỘI DUNG THEO MẪU
    // ==========================================

    const today = new Date();

    if (isDoan) {
      // ==========================================
      // MẪU ĐOÀN THANH NIÊN
      // ==========================================

      // 3 LOGO
      const logoHeight = 110;

      const logoDoanBoxWidth = 90;
      const logoBMUBoxWidth = 230;
      const logoHoiBoxWidth = 90;
      const logoGap = 25;

      const totalLogoWidth =
        logoDoanBoxWidth +
        logoBMUBoxWidth +
        logoHoiBoxWidth +
        logoGap * 2;

      const startLogoX =
        (PAGE_WIDTH - totalLogoWidth) / 2;

      const logoTop = 65;

      drawImageContain(
        page,
        logoDoan,
        startLogoX,
        logoTop,
        logoDoanBoxWidth,
        logoHeight
      );

      drawImageContain(
        page,
        logoBMU,
        startLogoX +
          logoDoanBoxWidth +
          logoGap,
        logoTop,
        logoBMUBoxWidth,
        logoHeight
      );

      drawImageContain(
        page,
        logoHoi,
        startLogoX +
          logoDoanBoxWidth +
          logoGap +
          logoBMUBoxWidth +
          logoGap,
        logoTop,
        logoHoiBoxWidth,
        logoHeight
      );

      // TÊN TỔ CHỨC
      drawCenteredFit(
        page,
        "ĐOÀN THANH NIÊN CỘNG SẢN HỒ CHÍ MINH",
        timesBold,
        43,
        30,
        190,
        1750,
        BROWN
      );

      drawCenteredFit(
        page,
        "TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT",
        timesBold,
        43,
        30,
        250,
        1750,
        BROWN
      );

      // TIÊU ĐỀ
      drawCenteredFit(
        page,
        "CHỨNG NHẬN",
        timesBold,
        100,
        70,
        365,
        1500,
        RED
      );

      // CHI HỘI
      drawCenteredFit(
        page,
        `Chi hội: ${student.lop || ""}`,
        timesBoldItalic,
        66,
        42,
        555,
        1400,
        BROWN
      );

      // CHI ĐOÀN
      drawCenteredFit(
        page,
        `Chi đoàn: ${student.lop || ""}`,
        timesBoldItalic,
        66,
        42,
        630,
        1500,
        BROWN
      );

      // ĐÃ BỎ ĐƯỜNG KẺ DƯỚI CHI ĐOÀN

      // NỘI DUNG HOẠT ĐỘNG
      let activityText =
        `Là tình nguyện viên chương trình ${program.ten_chuong_trinh || ""}`;

      if (program.ngay_bat_dau) {
        activityText +=
          ` tháng ${new Date(program.ngay_bat_dau).getMonth() + 1} năm ${new Date(program.ngay_bat_dau).getFullYear()}`;
      }

      const activityLines = wrapText(
        activityText,
        timesBoldItalic,
        54,
        1750
      );

      activityLines.forEach((line, index) => {
        drawCenteredFit(
          page,
          line,
          timesBoldItalic,
          54,
          38,
          780 + index * 75,
          1750,
          BROWN
        );
      });

      // NGÀY CẤP
      const dateText =
        `Đắk Lắk, ngày ${formatDate(today)}`;

      drawCenteredInArea(
        page,
        dateText,
        timesItalic,
        42,
        30,
        960,
        1050,
        850,
        BROWN
      );

      // CHỨC DANH
      const signLines = [
        "TM. BAN CHẤP HÀNH",
        "BÍ THƯ",
      ];

      const signTop = 1010;
      const signLineSpacing = 50;

      signLines.forEach((line, index) => {
        drawCenteredInArea(
          page,
          line,
          timesBold,
          42,
          30,
          signTop + index * signLineSpacing,
          1050,
          850,
          BROWN
        );
      });

      // TÊN NGƯỜI KÝ
      drawCenteredInArea(
        page,
        "Trịnh Thị Xuân Giang",
        timesBoldItalic,
        44,
        30,
        1210,
        1050,
        850,
        BROWN
      );

      // SỐ GCN
      drawTextTop(
        page,
        `Số: ${soChungNhan}`,
        timesBold,
        36,
        1280,
        BROWN,
        135
      );
    } else {
      // ==========================================
      // MẪU HỘI SINH VIÊN
      // ==========================================

      // 2 LOGO
      const logoHeight = 110;

      const logoBMUBoxWidth = 230;
      const logoHoiBoxWidth = 90;

      const logoGap = 35;

      const totalLogoWidth =
        logoBMUBoxWidth +
        logoGap +
        logoHoiBoxWidth;

      const startLogoX =
        (PAGE_WIDTH - totalLogoWidth) / 2;

      const logoTop = 65;

      drawImageContain(
        page,
        logoBMU,
        startLogoX,
        logoTop,
        logoBMUBoxWidth,
        logoHeight
      );

      drawImageContain(
        page,
        logoHoi,
        startLogoX +
          logoBMUBoxWidth +
          logoGap,
        logoTop,
        logoHoiBoxWidth,
        logoHeight
      );

      // TÊN TỔ CHỨC
      drawCenteredFit(
        page,
        "HỘI SINH VIÊN VIỆT NAM TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT",
        timesBold,
        43,
        30,
        190,
        1750,
        BROWN
      );

      // TIÊU ĐỀ
      drawCenteredFit(
        page,
        "CHỨNG NHẬN",
        timesBold,
        100,
        70,
        275,
        1500,
        RED
      );

      // HỌ TÊN - FONT GIỐNG GCN ĐOÀN
      drawCenteredFit(
        page,
        `Sinh viên: ${student.ho_ten || ""}`,
        timesBoldItalic,
        82,
        48,
        420,
        1600,
        BROWN
      );

      // CHI HỘI - FONT GIỐNG GCN ĐOÀN
      drawCenteredFit(
        page,
        `Chi hội: ${student.lop || ""}`,
        timesBoldItalic,
        66,
        42,
        555,
        1400,
        BROWN
      );

      // NỘI DUNG
      const content =
        `Đã tham gia hoạt động "${program.ten_chuong_trinh}"`;

      const contentLines = wrapText(
        content,
        timesItalic,
        54,
        1750
      );

      contentLines.forEach((line, index) => {
        drawCenteredFit(
          page,
          line,
          timesItalic,
          54,
          38,
          680 + index * 75,
          1750,
          BROWN
        );
      });

      // NGÀY CẤP
      const dateText =
        `Đắk Lắk, ngày ${formatDate(today)}`;

      const SIGN_AREA_X = 1050;
      const SIGN_AREA_WIDTH = 850;

      drawCenteredInArea(
        page,
        dateText,
        timesItalic,
        42,
        30,
        920,
        SIGN_AREA_X,
        SIGN_AREA_WIDTH,
        BROWN
      );

      // CHỨC DANH
      const signLines = [
        "TM. BAN THƯ KÝ HỘI SINH VIÊN VIỆT NAM",
        "TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT",
        "CHỦ TỊCH",
      ];

      const signTop = 970;
      const signLineSpacing = 44;

      signLines.forEach((line, index) => {
        drawCenteredInArea(
          page,
          line,
          timesBold,
          36,
          26,
          signTop + index * signLineSpacing,
          SIGN_AREA_X,
          SIGN_AREA_WIDTH,
          BROWN
        );
      });

      // TÊN NGƯỜI KÝ
      drawCenteredInArea(
        page,
        "Trịnh Thị Xuân Giang",
        timesBoldItalic,
        44,
        30,
        signTop + 230,
        SIGN_AREA_X,
        SIGN_AREA_WIDTH,
        BROWN
      );

      // SỐ GCN
      drawTextTop(
        page,
        `Số: ${soChungNhan}`,
        timesBold,
        36,
        1280,
        BROWN,
        135
      );
    }

    // ==========================================
    // XUẤT PDF
    // ==========================================

    const pdfBytes = await pdfDoc.save();

    // ==========================================
    // UPLOAD SUPABASE
    // ==========================================

    const safeName = student.ho_ten.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    uploadedPath =
      `${programId}/${participantId}/${Date.now()}-${safeName}.pdf`;

    const { error: uploadError } =
      await adminClient.storage
        .from(BUCKET)
        .upload(uploadedPath, pdfBytes, {
          contentType: "application/pdf",
          upsert: false,
        });

    if (uploadError) throw uploadError;

    // ==========================================
    // LƯU DATABASE
    // ==========================================

    const certificateData = {
      participant_id: participantId,
      so_chung_nhan: soChungNhan,
      file_url: uploadedPath,
      trang_thai: "da_phat_hanh",
      ngay_phat_hanh: today.toISOString().slice(0, 10),
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

    // ==========================================
    // XÓA FILE GCN CŨ SAU KHI LƯU THÀNH CÔNG
    // ==========================================

    if (
      existing?.file_url &&
      existing.file_url !== uploadedPath
    ) {
      await adminClient.storage
        .from(BUCKET)
        .remove([existing.file_url]);
    }

    return NextResponse.json({
      message: "Tạo giấy chứng nhận thành công.",
      so_chung_nhan: soChungNhan,
    });
  } catch (error) {
    console.error("Auto certificate error:", error);

    if (uploadedPath) {
      await adminClient.storage
        .from(BUCKET)
        .remove([uploadedPath]);
    }

    return NextResponse.json(
      {
        message:
          "Không thể tạo giấy chứng nhận tự động.",
      },
      { status: 500 }
    );
  }
}
