import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  IMPLEMENTATION_FORMS,
  PROJECT_TYPES,
  FUNDING_SOURCES,
  PROJECT_STATUSES,
  FUNDING_DETAILS,
  STATUSES_WITH_CONTRACT_FIELDS
} from "../src/data/formOptions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "../public/subprojectImportEnums.json");
writeFileSync(
  out,
  JSON.stringify({
    IMPLEMENTATION_FORMS,
    PROJECT_TYPES,
    FUNDING_SOURCES,
    PROJECT_STATUSES,
    FUNDING_DETAILS,
    STATUSES_WITH_CONTRACT_FIELDS
  }),
  "utf8"
);
console.log("Wrote", out);
