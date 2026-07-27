import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const googleDriveUploadUrl = process.env.VITE_GOOGLE_DRIVE_UPLOAD_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

if (!googleDriveUploadUrl) {
  console.error("❌ Missing VITE_GOOGLE_DRIVE_UPLOAD_URL in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse filename from Supabase storage public URL
function getFilenameFromUrl(url: string): string | null {
  try {
    const bucketMarker = "/portfolios/";
    const index = url.indexOf(bucketMarker);
    if (index === -1) return null;
    const pathPart = url.substring(index + bucketMarker.length);
    // Decode percent-encoded chars (e.g. spaces, special chars)
    return decodeURIComponent(pathPart.split("?")[0]);
  } catch (e) {
    return null;
  }
}

async function uploadToGoogleDrive(filename: string, buffer: Buffer): Promise<string> {
  const base64Data = buffer.toString("base64");
  
  const response = await fetch(googleDriveUploadUrl!, {
    method: "POST",
    body: JSON.stringify({
      filename: filename,
      mimeType: "application/pdf",
      base64Data: base64Data,
      folderName: "contracts",
    }),
    headers: {
      "Content-Type": "text/plain", // Bypasses preflight checks
    },
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script returned status ${response.status}`);
  }

  const result = (await response.json()) as any;
  if (!result.success) {
    throw new Error(result.error || "Google Drive upload failed");
  }

  return result.url;
}

async function run() {
  const tables = ["inspections", "contracted_customers", "non_contracted_customers"];
  let totalMigrated = 0;

  console.log("🚀 Starting portfolio migration to Google Drive...");

  for (const table of tables) {
    try {
      console.log(`\nChecking table: "${table}"...`);
      const { data: records, error: fetchError } = await supabase
        .from(table)
        .select("id, customer_name, portfolio")
        .not("portfolio", "is", null);

      if (fetchError) {
        console.error(`❌ Error fetching from table ${table}:`, fetchError.message);
        continue;
      }

      const supabaseRecords = records.filter(r => r.portfolio && r.portfolio.includes("supabase.co"));
      console.log(`Found ${supabaseRecords.length} records with Supabase portfolios out of ${records.length} total portfolios in "${table}".`);

      for (const record of supabaseRecords) {
        console.log(`  Processing record [${record.id}] for customer "${record.customer_name}"...`);
        const fileName = getFilenameFromUrl(record.portfolio);
        if (!fileName) {
          console.warn(`  ⚠️ Could not parse file name from URL: ${record.portfolio}`);
          continue;
        }

        console.log(`    Downloading "${fileName}" from Supabase Storage...`);
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("portfolios")
          .download(fileName);

        if (downloadError) {
          console.error(`    ❌ Failed to download "${fileName}" from storage:`, downloadError.message);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`    Uploading "${fileName}" to Google Drive...`);
        try {
          const driveUrl = await uploadToGoogleDrive(fileName, buffer);
          console.log(`    ✅ Successfully uploaded to Drive: ${driveUrl}`);

          console.log(`    Updating DB record...`);
          const { error: updateError } = await supabase
            .from(table)
            .update({ portfolio: driveUrl })
            .eq("id", record.id);

          if (updateError) {
            console.error(`    ❌ Failed to update DB record:`, updateError.message);
          } else {
            console.log(`    🎉 DB record updated successfully!`);
            totalMigrated++;
          }
        } catch (uploadError: any) {
          console.error(`    ❌ Failed to upload/process on Google Drive:`, uploadError.message || uploadError);
        }
      }
    } catch (tableError: any) {
      console.error(`❌ Error processing table ${table}:`, tableError.message || tableError);
    }
  }

  console.log(`\n🏁 Migration complete. Total files processed and updated: ${totalMigrated}`);
}

run();
