import * as path from "path";

export function replaceWindowsPath(inputPath: string): string {
  return inputPath.replaceAll(path.sep, path.posix.sep);
}

export function getRelativePathToMain(file: string, mainLaTeXFile: string): string;
export function getRelativePathToMain(file: string): Promise<string>;
export function getRelativePathToMain(file: string, mainLaTeXFile?: string): Promise<string> | string {
  if (mainLaTeXFile) {
    return replaceWindowsPath(path.relative(path.dirname(mainLaTeXFile), file));
  }

  return import("./fileUtils").then(({ findClosestMainLaTeXFile }) =>
    findClosestMainLaTeXFile().then((mainFile) => {
      if (!mainFile) return "";
      return getRelativePathToMain(file, mainFile);
    })
  );
}
