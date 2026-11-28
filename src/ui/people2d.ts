// 그림책 화풍 인물(캔버스): 유나(양 갈래 머리·노란 스웨터)·지우(짧은 머리·파란 스웨터). 상반신, 앞모습·뒷모습.
// 그림책 장면(ui/storybook)과 1장 창가 유나 세움판(scene/chapter1)이 같이 쓴다. 사람 에셋을 받으면 3D 인물로 바꾼다.

export interface Person2D {
  sweater: string;
  hair: string;
  /** 양 갈래(유나) / 짧은 머리(지우) */
  buns: boolean;
}

export const YUNA_2D: Person2D = { sweater: '#f2c230', hair: '#3a2418', buns: true };
export const JIWOO_2D: Person2D = { sweater: '#2f6fd0', hair: '#2a1e18', buns: false };

/**
 * 상반신(머리 + 어깨). 원점 = 어깨 아래 가운데, 크기 s(1이면 머리 지름 약 120). mood: 0 보통, 1 웃음, -1 시무룩.
 * look: 눈동자가 보는 쪽(-1 왼쪽 ~ 1 오른쪽). back이면 뒷모습(머리카락만)
 */
export function drawPerson(g: CanvasRenderingContext2D, p: Person2D, x: number, y: number, s: number, o: { mood?: number; look?: number; back?: boolean } = {}): void {
  const mood = o.mood ?? 0;
  const look = o.look ?? 0;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // 어깨·스웨터(둥근 사다리꼴) + 목둘레
  g.fillStyle = p.sweater;
  g.beginPath();
  g.moveTo(-110, 0);
  g.quadraticCurveTo(-104, -78, -40, -92);
  g.lineTo(40, -92);
  g.quadraticCurveTo(104, -78, 110, 0);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.1)';
  g.beginPath();
  g.ellipse(0, -90, 34, 10, 0, 0, Math.PI * 2);
  g.fill();
  // 목
  g.fillStyle = '#e8b896';
  g.fillRect(-16, -112, 32, 24);
  // 양 갈래(머리 뒤에)
  if (p.buns) {
    g.fillStyle = p.hair;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(sx * 62, -168, 26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d23a3a'; // 머리끈
      g.beginPath();
      g.arc(sx * 46, -166, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = p.hair;
    }
  }
  if (o.back) {
    // 뒷모습: 머리카락이 머리 전체
    g.fillStyle = p.hair;
    g.beginPath();
    g.arc(0, -170, 60, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  // 얼굴
  g.fillStyle = '#f6d2b6';
  g.beginPath();
  g.arc(0, -168, 58, 0, Math.PI * 2);
  g.fill();
  // 귀
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(sx * 57, -164, 11, 0, Math.PI * 2);
    g.fill();
  }
  // 앞머리
  g.fillStyle = p.hair;
  g.beginPath();
  if (p.buns) {
    g.arc(0, -178, 60, Math.PI * 1.02, Math.PI * 1.98);
    g.quadraticCurveTo(30, -186, 6, -166);
    g.quadraticCurveTo(-24, -190, -58, -176);
  } else {
    g.arc(0, -176, 61, Math.PI * 0.95, Math.PI * 2.05);
    g.quadraticCurveTo(40, -182, 18, -170);
    g.quadraticCurveTo(0, -186, -22, -170);
    g.quadraticCurveTo(-40, -184, -60, -168);
  }
  g.closePath();
  g.fill();
  // 볼
  g.fillStyle = 'rgba(232,110,110,0.35)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 30, -150, 11, 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 눈(눈동자가 look 쪽으로)
  g.fillStyle = '#1b1210';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 21 + look * 4, -164 + (mood < 0 ? 2 : 0), 6, mood > 0 ? 5 : 7.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 눈썹(시무룩이면 처진다)
  g.strokeStyle = p.hair;
  g.lineWidth = 4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 12, -182 - (mood < 0 ? -2 : 0));
    g.lineTo(sx * 30, -182 + (mood < 0 ? 5 : 0));
    g.stroke();
  }
  // 입
  g.strokeStyle = '#a8423a';
  g.lineWidth = 4;
  g.beginPath();
  if (mood > 0) g.arc(0, -146, 14, 0.25, Math.PI - 0.25);
  else if (mood < 0) g.arc(0, -134, 10, Math.PI + 0.5, -0.5);
  else {
    g.moveTo(-8, -142);
    g.lineTo(8, -142);
  }
  g.stroke();
  g.restore();
}
