/** @type {import('next').NextConfig} */
const nextConfig = {
  // db.js가 실행 중에 읽는 표 정의를 배포 파일에 함께 넣음
  outputFileTracingIncludes: { '/**': ['./data/schema.sql'] },
};

export default nextConfig;
