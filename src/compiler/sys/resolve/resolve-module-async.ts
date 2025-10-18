import { isString, normalizeFsPath, normalizePath } from '@utils';
import { dirname } from 'path';
import resolve, { type AsyncOpts, type PackageJSON } from 'resolve';

import type * as d from '../../../declarations';
import { InMemoryFileSystem } from '../in-memory-fs';
import { getPackageDirPath } from './resolve-utils';

export const resolveModuleIdAsync = (
  sys: d.CompilerSystem,
  inMemoryFs: InMemoryFileSystem,
  opts: d.ResolveModuleIdOptions,
) => {
  const resolverOpts: AsyncOpts = createCustomResolverAsync(sys, inMemoryFs, opts.exts);
  resolverOpts.basedir = dirname(normalizeFsPath(opts.containingFile));

  if (opts.packageFilter) {
    resolverOpts.packageFilter = opts.packageFilter;
  } else if (opts.packageFilter !== null) {
    resolverOpts.packageFilter = (pkg: PackageJSON) => {
      if (!isString(pkg.main) || pkg.main === '') {
        pkg.main = 'package.json';
      }
      return pkg;
    };
  }

  return new Promise<d.ResolveModuleIdResults>((resolvePromise, rejectPromise) => {
    resolve(opts.moduleId, resolverOpts, (err, resolveId, pkgData) => {
      if (err) {
        rejectPromise(err);
        return;
      }

      if (!resolveId) {
        rejectPromise(new Error(`Unable to resolve module: ${opts.moduleId}`));
        return;
      }

      const normalizedResolveId = normalizePath(resolveId);
      const normalizedPkgData = normalizePkgData(pkgData, opts.moduleId);
      const results: d.ResolveModuleIdResults = {
        moduleId: opts.moduleId,
        resolveId: normalizedResolveId,
        pkgData: normalizedPkgData,
        pkgDirPath: getPackageDirPath(normalizedResolveId, opts.moduleId),
      };
      resolvePromise(results);
    });
  });
};

export const createCustomResolverAsync = (
  sys: d.CompilerSystem,
  inMemoryFs: InMemoryFileSystem,
  exts?: string[],
): any => {
  return {
    async isFile(filePath: string, cb: (err: any, isFile: boolean) => void) {
      const fsFilePath = normalizeFsPath(filePath);

      const stat = await inMemoryFs.stat(fsFilePath);
      if (stat.isFile) {
        cb(null, true);
        return;
      }

      cb(null, false);
    },

    async isDirectory(dirPath: string, cb: (err: any, isDirectory: boolean) => void) {
      const fsDirPath = normalizeFsPath(dirPath);

      const stat = await inMemoryFs.stat(fsDirPath);
      if (stat.isDirectory) {
        cb(null, true);
        return;
      }

      cb(null, false);
    },

    async readFile(p: string, cb: (err: any, data?: any) => void) {
      const fsFilePath = normalizeFsPath(p);

      const data = await inMemoryFs.readFile(fsFilePath);
      if (isString(data)) {
        return cb(null, data);
      }

      return cb(`readFile not found: ${p}`);
    },

    async realpath(p: string, cb: (err: any, data?: any) => void) {
      const fsFilePath = normalizeFsPath(p);
      const results = await sys.realpath(fsFilePath);

      if (results.error && results.error.code !== 'ENOENT') {
        cb(results.error);
      } else {
        cb(null, results.error ? fsFilePath : results.path);
      }
    },

    extensions: exts,
  };
};

const normalizePkgData = (pkgData: PackageJSON | undefined, moduleId: string): d.ResolveModuleIdResults['pkgData'] => {
  const normalized = { ...(pkgData ?? {}) } as d.ResolveModuleIdResults['pkgData'];

  if (!isString(normalized.name) || normalized.name.length === 0) {
    normalized.name = moduleId;
  }

  if (!isString(normalized.version) || normalized.version.length === 0) {
    normalized.version = '0.0.0';
  }

  return normalized;
};
