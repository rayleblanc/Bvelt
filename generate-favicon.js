import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.join(process.cwd(), 'public');
const assetsImgDir = path.join(process.cwd(), 'src/assets/images');

const candidatePaths = [
  path.join(process.cwd(), 'src/assets/images/bvelt-icon-512.png'),
  path.join(process.cwd(), 'public/bvelt-icon-512.png'),
  path.join(process.cwd(), 'src/assets/images/bvelt-icon-512.jpg'),
  path.join(process.cwd(), 'public/icon-512.png'),
  path.join(process.cwd(), 'public/favicon.png')
];

async function generateBrandIcons() {
  try {
    const masterIcon = candidatePaths.find(p => fs.existsSync(p));

    if (!masterIcon) {
      console.warn('⚠️ Warning: No se encontró ningún icono maestro en las rutas conocidas. Se mantendrán los favicons existentes en public/.');
      return;
    }

    console.log('🎨 Generando favicons a partir del icono maestro:', masterIcon);
    const inputBuffer = fs.readFileSync(masterIcon);

    // Ensure output directories exist
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(assetsImgDir)) fs.mkdirSync(assetsImgDir, { recursive: true });

    // 1. Standard PNG Icons
    await Promise.all([
      sharp(inputBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'bvelt-icon-512.png')),
      sharp(inputBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'bvelt-icon-192.png')),
      sharp(inputBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png')),
      sharp(inputBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png')),
      sharp(inputBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png')),
      sharp(inputBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon-precomposed.png')),
      sharp(inputBuffer).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png')),
      sharp(inputBuffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico')),
      sharp(inputBuffer).resize(512, 512).png().toFile(path.join(assetsImgDir, 'bvelt-icon-512.png')),
      sharp(inputBuffer).resize(192, 192).png().toFile(path.join(assetsImgDir, 'bvelt-icon-192.png'))
    ]);

    // 2. Maskable Icons with safe-zone padding (#0a0f1d background)
    const img192Padded = await sharp(inputBuffer).resize(154, 154).png().toBuffer();
    await sharp({
      create: { width: 192, height: 192, channels: 4, background: { r: 10, g: 15, b: 29, alpha: 1 } }
    }).composite([{ input: img192Padded, gravity: 'center' }]).png().toFile(path.join(publicDir, 'bvelt-icon-maskable-192.png'));

    const img512Padded = await sharp(inputBuffer).resize(410, 410).png().toBuffer();
    await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 10, g: 15, b: 29, alpha: 1 } }
    }).composite([{ input: img512Padded, gravity: 'center' }]).png().toFile(path.join(publicDir, 'bvelt-icon-maskable-512.png'));

    console.log('✅ Todos los iconos B+rayo generados con Sharp correctamente.');
  } catch (error) {
    console.warn('⚠️ Warning al generar assets de iconos:', error?.message || error);
  }
}

generateBrandIcons();
