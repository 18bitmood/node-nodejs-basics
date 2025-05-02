import os from 'os';
import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';

const initFileManager = async () => {
  const username = getUserName();
  const homeDir = os.homedir();

  process.chdir(homeDir);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`Welcome to the File Manager, ${username}!`);
  console.log(`You are currently in ${process.cwd()}`);
  console.log('Print a command or "exit" to quit.');

  rl.on('line', async (input) => {
    if (input.trim() === 'exit') {
      rl.close();
      return;
    }

    await handleUserInput(input);

    console.log(`You are currently in ${process.cwd()}\n`);
  });

  process.on('SIGINT', () => {
    rl.close();
  });

  rl.on('close', () => {
    console.log(`Thank you for using File Manager, ${username}, goodbye!`);
    process.exit(0);
  });
};

const handleUserInput = async (input) => {
  const trimmedInput = input.trim();

  const [command, ...args] = trimmedInput.split(' ');

  try {
    switch (command) {
      case 'up':
        return handleNavUpCommand();

      case 'cd':
        return await handleNavCdCommand(args);

      case 'ls':
        return await handleListCommand();

      case 'cat':
        return await handleCatCommand(args);

      case 'add':
        return await handleAddCommand(args);

      case 'mkdir':
        return await handleMkdirCommand(args);

      case 'rn':
        return await handleRenameCommand(args);

      case 'cp':
        return await handleCopyCommand(args);

      case 'mv':
        return await handleMoveCommand(args);

      case 'rm':
        return await handleRemoveCommand(args);

      case 'os':
        return handleOsCommand(args);

      case 'hash':
        return await handleHashCommand(args);

      case 'compress':
        return await handleCompressCommand(args);

      case 'decompress':
        return await handleDecompressCommand(args);

      default:
        console.log('Invalid input: unknown command');
        return false;
    }
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleNavUpCommand = () => {
  const currentDir = process.cwd();
  const parentDir = path.dirname(currentDir);

  if (currentDir === parentDir) {
    console.log('Already at root directory');
    return false;
  } else {
    process.chdir(parentDir);
    return true;
  }
};

const handleNavCdCommand = async (args) => {
  if (args.length === 0) {
    console.log('Invalid input: directory path is required');
    return false;
  }

  const dirPath = args[0];
  let targetPath;

  if (path.isAbsolute(dirPath)) {
    targetPath = dirPath;
  } else {
    targetPath = path.join(process.cwd(), dirPath);
  }

  if (await isDirectoryExists(targetPath)) {
    process.chdir(targetPath);
    return true;
  } else {
    console.log('Operation failed: directory does not exist');
    return false;
  }
};

const handleListCommand = async () => {
  try {
    const currentDir = process.cwd();
    const dirEntries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    const directories = [];
    const files = [];

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        directories.push({ name: entry.name, type: 'DIR' });
      } else {
        files.push({ name: entry.name, type: 'FILE' });
      }
    }

    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    const sortedEntries = [...directories, ...files];

    console.log('\nName\t\t\tType');
    console.log('-----------------------------------');

    for (const entry of sortedEntries) {
      const paddedName = entry.name.padEnd(24);
      console.log(`${paddedName}${entry.type}`);
    }

    console.log("-----------------------------------\n");
    return true;
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleCatCommand = async (args) => {
  if (args.length === 0) {
    console.log('Invalid input: file path is required');
    return false;
  }

  const filePath = resolvePath(args[0]);

  if (!await isFileExists(filePath)) {
    console.log('Operation failed: file does not exist');
    return false;
  }

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(filePath, { encoding: 'utf8' });

    readStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    let data = '';
    readStream.on('data', (chunk) => {
      data += chunk;
    });

    readStream.on('end', () => {
      console.log(data);
      resolve(true);
    });
  });
};

const handleAddCommand = async (args) => {
  if (args.length === 0) {
    console.log('Invalid input: filename is required');
    return false;
  }

  const fileName = args[0];
  const filePath = path.join(process.cwd(), fileName);

  if (await isFileExists(filePath)) {
    console.log('Operation failed: file already exists');
    return false;
  }

  try {
    await fs.promises.writeFile(filePath, '', 'utf8');
    return true;
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleMkdirCommand = async (args) => {
  if (args.length === 0) {
    console.log('Invalid input: directory name is required');
    return false;
  }

  const dirName = args[0];
  const dirPath = path.join(process.cwd(), dirName);

  if (await isDirectoryExists(dirPath) || await isFileExists(dirPath)) {
    console.log('Operation failed: directory or file already exists');
    return false;
  }

  try {
    await fs.promises.mkdir(dirPath);
    return true;
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleRenameCommand = async (args) => {
  if (args.length < 2) {
    console.log('Invalid input: source path and new filename are required');
    return false;
  }

  const sourcePath = resolvePath(args[0]);
  const newFileName = args[1];
  const targetPath = path.join(path.dirname(sourcePath), newFileName);

  if (!await isFileExists(sourcePath)) {
    console.log('Operation failed: source file does not exist');
    return false;
  }

  if (await isFileExists(targetPath)) {
    console.log('Operation failed: destination file already exists');
    return false;
  }

  try {
    await fs.promises.rename(sourcePath, targetPath);
    return true;
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleCopyCommand = async (args) => {
  if (args.length < 2) {
    console.log('Invalid input: source path and destination directory are required');
    return false;
  }

  const sourcePath = resolvePath(args[0]);
  const destDir = resolvePath(args[1]);

  if (!await isFileExists(sourcePath)) {
    console.log('Operation failed: source file does not exist');
    return false;
  }

  if (!await isDirectoryExists(destDir)) {
    console.log('Operation failed: destination directory does not exist');
    return false;
  }

  const fileName = path.basename(sourcePath);
  const destPath = path.join(destDir, fileName);

  if (await isFileExists(destPath)) {
    console.log('Operation failed: destination file already exists');
    return false;
  }

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(destPath);

    readStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    writeStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    writeStream.on('finish', () => {
      resolve(true);
    });

    readStream.pipe(writeStream);
  });
};

const handleMoveCommand = async (args) => {
  if (args.length < 2) {
    console.log('Invalid input: source path and destination directory are required');
    return false;
  }

  const sourcePath = resolvePath(args[0]);
  const destDir = resolvePath(args[1]);

  if (!await isFileExists(sourcePath)) {
    console.log('Operation failed: source file does not exist');
    return false;
  }

  if (!await isDirectoryExists(destDir)) {
    console.log('Operation failed: destination directory does not exist');
    return false;
  }

  const fileName = path.basename(sourcePath);
  const destPath = path.join(destDir, fileName);

  if (await isFileExists(destPath)) {
    console.log('Operation failed: destination file already exists');
    return false;
  }

  try {
    await new Promise((resolve, reject) => {
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destPath);

      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);

      readStream.pipe(writeStream);
    });

    await fs.promises.unlink(sourcePath);
    return true;
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleRemoveCommand = async (args) => {
  if (args.length === 0) {
    console.log('Invalid input: file path is required');
    return false;
  }

  const filePath = resolvePath(args[0]);

  if (!await isFileExists(filePath)) {
    console.log('Operation failed: file does not exist');
    return false;
  }

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    console.log('Operation failed');
    return false;
  }
};

const handleOsCommand = (args) => {
  if (args.length === 0) {
    console.log('Invalid input: OS option is required');
    return false;
  }

  const option = args[0];

  switch (option) {
    case '--EOL':
      console.log(JSON.stringify(os.EOL));
      return true;

    case '--cpus':
      const cpus = os.cpus();
      console.log(`Total CPUs: ${cpus.length}`);
      cpus.forEach((cpu, index) => {
        console.log(`CPU ${index + 1}: ${cpu.model} (${(cpu.speed / 1000).toFixed(2)} GHz)`);
      });
      return true;

    case '--homedir':
      console.log(os.homedir());
      return true;

    case '--username':
      console.log(os.userInfo().username);
      return true;

    case '--architecture':
      console.log(process.arch);
      return true;

    default:
      console.log('Invalid input: unknown OS option');
      return false;
  }
};

const handleHashCommand = async (args) => {
  if (args.length === 0) {
    console.log('Invalid input: file path is required');
    return false;
  }

  const filePath = resolvePath(args[0]);

  if (!await isFileExists(filePath)) {
    console.log('Operation failed: file does not exist');
    return false;
  }

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      console.log(hash.digest('hex'));
      resolve(true);
    });
  });
};

const handleCompressCommand = async (args) => {
  if (args.length < 2) {
    console.log('Invalid input: source file and destination path are required');
    return false;
  }

  const sourcePath = resolvePath(args[0]);
  const destPath = resolvePath(args[1]);

  if (!await isFileExists(sourcePath)) {
    console.log('Operation failed: source file does not exist');
    return false;
  }

  if (await isFileExists(destPath)) {
    console.log('Operation failed: destination file already exists');
    return false;
  }

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(sourcePath);
    const brotliStream = zlib.createBrotliCompress();
    const writeStream = createWriteStream(destPath);

    readStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    brotliStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    writeStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    writeStream.on('finish', () => {
      resolve(true);
    });

    readStream.pipe(brotliStream).pipe(writeStream);
  });
};

const handleDecompressCommand = async (args) => {
  if (args.length < 2) {
    console.log('Invalid input: source file and destination path are required');
    return false;
  }

  const sourcePath = resolvePath(args[0]);
  const destPath = resolvePath(args[1]);

  if (!await isFileExists(sourcePath)) {
    console.log('Operation failed: source file does not exist');
    return false;
  }

  if (await isFileExists(destPath)) {
    console.log('Operation failed: destination file already exists');
    return false;
  }

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(sourcePath);
    const brotliStream = zlib.createBrotliDecompress();
    const writeStream = createWriteStream(destPath);

    readStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    brotliStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    writeStream.on('error', (error) => {
      console.log('Operation failed');
      reject(error);
    });

    writeStream.on('finish', () => {
      resolve(true);
    });

    readStream.pipe(brotliStream).pipe(writeStream);
  });
};

const resolvePath = (inputPath) => {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  } else {
    return path.join(process.cwd(), inputPath);
  }
};

const isDirectoryExists = async (dirPath) => {
  try {
    const stats = await fs.promises.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
};

const isFileExists = async (filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch (error) {
    return false;
  }
};

const getUserName = () => {
  const args = process.argv.slice(2);
  let username = 'User';

  for (const arg of args) {
    if (arg.startsWith('--username=')) {
      username = arg.split('=')[1];
      break;
    }
  }

  return username;
};

await initFileManager();
