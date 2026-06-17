import { formatSmtpError } from "./src/lib/smtp-verify";

function testFormatSmtpError() {
  const secretErrorDetails = "THIS_IS_A_SECRET_DATABASE_URL_OR_API_KEY";
  const err = new Error(secretErrorDetails);

  const result = formatSmtpError(err);

  if (result.ok) {
    console.error("Test failed: Expected an error result.");
    process.exit(1);
  }

  const hint = result.hint;
  if (!hint) {
    console.error("Test failed: Expected a hint.");
    process.exit(1);
  }

  if (hint.includes(secretErrorDetails)) {
    console.error("Test failed: The hint contains the secret error details!");
    console.error("Hint:", hint);
    process.exit(1);
  }

  console.log("Test passed: The secret error details are not exposed in the hint.");
}

testFormatSmtpError();
