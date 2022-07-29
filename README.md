# Server Side Test Sample


npm install
npm run dev


local port 를 외부 망에서도 접속 가능하게 하는 라이브러리 설치

npm i -g localtunnel

아래와 같이 실행 후 응답 되는 url 에 https 로 변경하여 모바일에 브라우저에서
로드하여야 카메라와 마이크 권한 승인 가능합니다. (같은 와이파이 추천)

- 예시
lt --port 3000 --subdomain localtunnelme
your url is: http://localtunnelme.loca.lt   -> 응답 값
