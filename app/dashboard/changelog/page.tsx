import fs from "fs";
import path from "path";
import { marked } from "marked";

export default function ChangelogPage() {
  const raw = fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf-8");
  const entries = raw.slice(raw.indexOf("\n## "));
  const html = marked.parse(entries, { async: false });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Version History</h1>
      <div className="changelog" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
