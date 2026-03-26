import type { NextConfig } from 'next';
import path from 'node:path';
//testung
const nextConfig: NextConfig = {
	turbopack: {
		root: path.resolve(__dirname),
	},
};

export default nextConfig;
