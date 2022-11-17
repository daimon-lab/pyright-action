import assert from "node:assert";
import * as cp from "node:child_process";

import * as core from "@actions/core";
import * as command from "@actions/core/lib/command";

import { getActionVersion, getArgs } from "./helpers";
import { Diagnostic, isEmptyRange, parseReport } from "./schema";

export async function main() {
    try {
        const { workingDirectory, noComments, args } = await getArgs();
        if (workingDirectory) {
            process.chdir(workingDirectory);
        }

        core.info(`pyright, pyright-action ${getActionVersion()}`);
        core.info(`pdm run ${args.join(" ")}`);

        // We check for --verifytypes as an arg instead of a flag because it may have
        // been passed via extra-args.
        if (noComments || args.includes("--verifytypes")) {
            // If comments are disabled, there's no point in directly processing the output,
            // as it's only used for comments.
            // If we're running the type verifier, there's no guarantee that we can even act
            // on the output besides the exit code.
            //
            // So, in either case, just directly run pyright and exit with its status.
            const { status } = cp.spawnSync("pdm", args, {
                stdio: ["ignore", "inherit", "inherit"],
            });

            if (status !== 0) {
                core.setFailed(`Exit code ${status!}`);
            }
            return;
        }

        const { status, stdout } = cp.spawnSync("pdm", args, {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "inherit"],
            maxBuffer: 100 * 1024 * 1024, // 100 MB "ought to be enough for anyone"; https://github.com/nodejs/node/issues/9829
        });

        if (!stdout.trim()) {
            // Process crashed. stderr was inherited, so just mark the step as failed.
            core.setFailed(`Exit code ${status!}`);
            return;
        }

        const report = parseReport(JSON.parse(stdout));

        report.generalDiagnostics.forEach((diag) => {
            core.info(diagnosticToString(diag, /* forCommand */ false));

            if (diag.severity === "information") {
                return;
            }

            const line = diag.range?.start.line ?? 0;
            const col = diag.range?.start.character ?? 0;
            const message = diagnosticToString(diag, /* forCommand */ true);

            // This is technically a log line and duplicates the core.info above,
            // but we want to have the below look nice in commit comments.
            command.issueCommand(
                diag.severity,
                {
                    file: diag.file,
                    line: line + 1,
                    col: col + 1,
                },
                message,
            );
        });

        const { errorCount, warningCount, informationCount } = report.summary;

        core.info(
            [
                pluralize(errorCount, "error", "errors"),
                pluralize(warningCount, "warning", "warnings"),
                pluralize(informationCount, "information", "informations"),
            ].join(", "),
        );

        if (status !== 0) {
            core.setFailed(pluralize(errorCount, "error", "errors"));
        }
    } catch (e) {
        assert(typeof e === "string" || e instanceof Error);
        core.setFailed(e);
    }
}

// Copied from pyright, with modifications.
function diagnosticToString(diag: Diagnostic, forCommand: boolean): string {
    let message = "";

    if (!forCommand) {
        if (diag.file) {
            message += `${diag.file}:`;
        }
        if (diag.range && !isEmptyRange(diag.range)) {
            message += `${diag.range.start.line + 1}:${diag.range.start.character + 1} -`;
        }
        message += ` ${diag.severity}: `;
    }

    message += diag.message;

    if (diag.rule) {
        message += ` (${diag.rule})`;
    }

    return message;
}

function pluralize(n: number, singular: string, plural: string) {
    return `${n} ${n === 1 ? singular : plural}`;
}
