# splat-pixel-temple

月見猫 (つきみねこ), "Moon-Viewing Cat": a pixel-art scene of a three-storey pagoda at dusk, with a calico cat on a stone wall watching the full moon next to a stack of 月見団子. There are no sprites. The whole picture is a cloud of about 8,500 3D Gaussian splats, rendered live.

## How it works

1. **Splat.** Every object is built from anisotropic 3D Gaussians: flat ones tiled over walls, roofs and the ground, round ones for the cat, the cedars and the maple leaves. Each frame their 3D covariances are projected through a perspective camera into 2D ellipses, the same maths as in 3D Gaussian Splatting.
2. **Blend.** A small software rasteriser paints the ellipses back to front into a low-resolution buffer (256×160 by default). "Hard" splats have an opacity above 1 and are alpha-tested at one half, which gives crisp pixel edges. Sky bands, mist and lantern glow are ordinary soft splats.
3. **Snap.** Each pixel is mapped to the nearest colour of a small palette with 4×4 Bayer dithering.

The page has three views (pixel art, the raw blended splats, and the outline of every Gaussian), four palettes and three resolutions. Moving the pointer over the picture orbits the camera.

## Running it

Open `index.html` in a browser. It is a single file with no dependencies and no build step. (It has no `<!doctype>` or `<html>` wrapper because it is also published as a Claude artifact, which adds its own.)
