import * as core from "@actions/core";
import stringArgv from "string-argv";

import { version as actionVersion } from "../package.json";

export function getActionVersion() {
    return actionVersion;
}

export async function getArgs() {
    const args = ["run", "pyright"];

    const noComments = getBooleanInput("no-comments", false);
    if (!noComments) {
        args.push("--outputjson");
    }

    const pythonPlatform = core.getInput("python-platform");
    if (pythonPlatform) {
        args.push("--pythonplatform");
        args.push(pythonPlatform);
    }

    const pythonVersion = core.getInput("python-version");
    if (pythonVersion) {
        args.push("--pythonversion");
        args.push(pythonVersion);
    }

    const typeshedPath = core.getInput("typeshed-path");
    if (typeshedPath) {
        args.push("--typeshed-path");
        args.push(typeshedPath);
    }

    const venvPath = core.getInput("venv-path");
    if (venvPath) {
        args.push("--venv-path");
        args.push(venvPath);
    }

    const project = core.getInput("project");
    if (project) {
        args.push("--project");
        args.push(project);
    }

    const lib = getBooleanInput("lib", false);
    if (lib) {
        args.push("--lib");
    }

    const warnings = getBooleanInput("warnings", false);
    if (warnings) {
        args.push("--warnings");
    }

    const verifyTypes = core.getInput("verify-types");
    if (verifyTypes) {
        args.push("--verifytypes");
        args.push(verifyTypes);
    }

    const extraArgs = core.getInput("extra-args");
    if (extraArgs) {
        args.push(...stringArgv(extraArgs));
    }

    return {
        workingDirectory: core.getInput("working-directory"),
        noComments,
        args,
    };
}

function getBooleanInput(name: string, defaultValue: boolean): boolean {
    const input = core.getInput(name);
    if (!input) {
        return defaultValue;
    }
    return input.toUpperCase() === "TRUE";
}
