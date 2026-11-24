import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline/promises";

const uid = "5fdb2336-99dd-4995-811a-a7198e901feb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const password = await rl.question("Nhap mat khau moi: ");
rl.close();

if (password.length < 8) {
  console.log("Mat khau phai co it nhat 8 ky tu.");
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(uid, {
  password,
});

if (error) {
  console.log("Loi:", error.message);
  process.exit(1);
}

console.log("Da doi mat khau thanh cong!");