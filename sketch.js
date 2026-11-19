// Không cho trình duyệt nhớ vị trí cuộn khi tải lại trang
// → mỗi lần reload trang luôn bắt đầu từ trên cùng (chưa có nước).
history.scrollRestoration = "manual";

// ======================= BẢNG MÀU =======================
let skyColor = ["#adccef", "#ffffff"];

let buildingPalette = [
  ["#7EC8F2", "#A9DCF7", "#D6EEFB", "#F6FBFF"],
  ["#8FD6E8", "#B6E6F1", "#DAF2F8", "#F7FDFE"],
  ["#8FB8F0", "#B5D0F6", "#DCE8FA", "#F8FAFF"],
  ["#9AA8F0", "#BAC3F6", "#DDE1FA", "#F9F9FF"],
  ["#A99BEA", "#C6BCF2", "#E3DDF8", "#FBF9FF"],
  ["#6FB6E8", "#A6A8EE", "#D9C2F2", "#FCEFF9"],
  ["#8CC4F0", "#B9B6F0", "#EBC4EA", "#FFF5FB"],
  ["#9CD3EE", "#C6C3F2", "#F2CDE8", "#FFF7FB"],
  ["#B2A6F0", "#D3B8EE", "#F4C6E4", "#FFF6FB"],
  ["#86D4DC", "#A9D4F2", "#C9C6F2", "#F5EEFC"],
];

let brightPalette = [
  ["#12B6F0", "#3FCBF5", "#A8E9FA", "#F0FDFF"],
  ["#8B7BF0", "#AB9EF5", "#D6CEFB", "#F8F5FF"],
  ["#F29BD0", "#F7BBE0", "#FCDDF0", "#FFF7FC"],
  ["#FBE36B", "#FCEB92", "#FEF3C2", "#FFFBEA"],
];

let backgroundBuildingsColor = ["#fdf0ec", "#aee1f9"];

let sunkenCityColor = ["#052a3fff", "#041f30ff", "#031521ff", "#000000"];

let sunkenWindowColor = "#0c3b52ff";

let centerBuildingColor = ["#6C95D3", "#91B1E1", "#B0C4E6", "#D8E2F3"];

let groundBackgroundColor = ["#A7DCFF", "#DCE9FA", "#FFFFFF"];

let reflectionFadeColor = [
  "rgba(220, 232, 250, 0)",
  "rgba(255, 255, 255, 0.6)",
  "#ffffff",
];

let underwaterStops = [
  [0, "#0C6880"],
  [0.06, "#0E7188"],
  [0.12, "#13889C"],
  [0.18, "#19A2B4"],
  [0.24, "#1EB9C8"],
  [0.3, "#20C2D0"],
  [0.4, "#1FBAC8"],
  [0.5, "#1BA5B5"],
  [0.6, "#16899A"],
  [0.7, "#106B7C"],
  [0.8, "#0B4F61"],
  [0.9, "#073A4E"],
  [1, "#063246"],
];

let waterOverlayStops = [
  [0, "rgba(70, 130, 190, 0.08)"],
  [0.02, "rgba(70, 130, 190, 0.18)"],
  [0.12, "rgba(70, 130, 190, 0.28)"],
  [1, "rgba(143, 195, 228, 0)"],
];

let groundlineStops = [
  [0, "#f1e5f6"],
  [0.5, "#b7e3f4"],
  [1, "#f1cfed"],
];

// ======================= BIẾN TRẠNG THÁI =======================
// Các biến dùng chung cho nhiều hàm.

// Danh sách các cụm nhà chính. Mỗi phần tử là 1 object:
// { type, x, w, h, colors, windowStyle, windowSide }
let structures = [];

// "Hạt giống" cho random(). Cùng 1 seed thì random() ra cùng 1 dãy số.
// Đặt lại seed mỗi lần vẽ → nhà và hình phản chiếu không bị đổi khi vẽ lại.
let structureSeed = 1; // cho thành phố chính
let backgroundSeed = 1; // cho dãy nhà nền

let groundYRatio = 0.87;
let groundLineH = 6;
let waterProgress = 0;
let cityDarkness = 0;
let introStartMs = 0; // thời điểm bắt đầu animation (mili giây, lấy từ millis())
let introTime = 0; // đã chạy animation được bao nhiêu GIÂY (cập nhật mỗi khung hình trong draw)
let introDuration = 2; // tổng thời gian animation (giây). Hết thời gian này thì dừng vẽ liên tục.

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);

  // Đặt canvas vào trong thẻ <div id="scene"> của file HTML
  canvas.parent("scene");
  noStroke();

  // KHÔNG gọi noLoop() ở đây nữa: để p5 vẽ liên tục ~60 khung hình/giây
  // trong lúc chạy animation. Hết animation, draw() sẽ tự gọi noLoop().
  introStartMs = millis(); // ghi lại lúc bắt đầu
  generateCity();

  // Đọc vị trí cuộn hiện tại 1 lần để đặt trạng thái ban đầu (tiêu đề, text)
  updateWaterFromScroll();

  // Đăng ký: mỗi khi người dùng cuộn trang → gọi updateWaterFromScroll
  window.addEventListener("scroll", updateWaterFromScroll);
}

function draw() {
  // Số giây đã trôi qua kể từ lúc bắt đầu animation (millis() tính bằng mili giây → chia 1000)
  introTime = (millis() - introStartMs) / 1000;

  let groundY = height * groundYRatio;

  // ---- Tính mức chìm "sink" (từ 0 đến 1) ----
  // waterProgress tăng đều theo độ cuộn. Công thức smoothstep p*p*(3 - 2p)
  // làm nó chậm ở đầu, nhanh ở giữa, chậm ở cuối → nước dâng mượt, không giật.
  let p = waterProgress;
  let sink = p * p * (3 - 2 * p);

  // fade = độ rõ của nền đất, nhà nền, tháp giữa, phản chiếu.
  // map(giá_trị, a, b, c, d, true) đổi giá trị từ khoảng [a, b] sang khoảng [c, d]:
  //   sink = 0   → fade = 1 (hiện rõ)
  //   sink = 0.1 → fade = 0.5
  //   sink = 0.2 → fade = 0 (biến mất)
  //   true = không cho vượt khoảng, nên sink > 0.2 thì fade vẫn là 0
  let fade = map(sink, 0, 0.2, 1, 0, true);

  // lerp(a, b, t) = điểm nằm giữa a và b theo tỉ lệ t (t = 0 → a, t = 1 → b).
  // Đường đất của thành phố trượt từ groundY xuống đáy màn hình → thành phố chìm xuống.
  let cityGroundY = lerp(groundY, height, sink);

  // Mặt nước đi từ đáy màn hình (y = height) lên đỉnh màn hình (y = 0)
  let waterY = lerp(height, 0, sink);

  cityDarkness = sink;

  background("#ffffff");
  drawSky(groundY);
  drawGroundBackground(groundY, fade);
  drawWater(waterY, underwaterStops);
  drawBackgroundBuildings(groundY, fade);
  drawCenterBuilding(groundY, fade);
  drawMainCity(cityGroundY);
  drawBuildingReflections(cityGroundY, fade);
  drawReflectionFade(cityGroundY, fade);
  drawGroundline(cityGroundY, fade);
  drawWater(waterY, waterOverlayStops);

  // Animation đã chạy xong → tắt vẽ liên tục.
  // Từ giờ chỉ vẽ lại khi cuộn (redraw() trong updateWaterFromScroll), giống như trước.
  if (introTime >= introDuration) {
    noLoop();
  }
}

// Tính xem một vật đã "mọc lên" được bao nhiêu phần (0 = còn nằm dưới đất, 1 = mọc xong).
function riseAmount(startTime, duration) {
  // t = tiến độ tuyến tính 0 → 1. constrain kẹp lại: chưa tới giờ thì 0, quá giờ thì 1.
  let t = constrain((introTime - startTime) / duration, 0, 1);

  // "Ease-out": 1 - (1 - t)³ → lúc đầu trồi lên nhanh, gần tới nơi thì chậm lại cho mềm.
  //   t = 0   → 0
  //   t = 0.5 → 0.875 (mới nửa thời gian đã lên được 87.5%)
  //   t = 1   → 1
  return 1 - pow(1 - t, 3);
}

// Chỉ cho vẽ phần nằm TRÊN đường đất; phần nào thò xuống dưới đất sẽ bị cắt bỏ (clip).
// Nhờ vậy khi đẩy nhà xuống dưới đất rồi kéo dần lên, ta thấy nhà "trồi" lên từ mặt đất.
function clipAboveGround(groundY, drawFn) {
  let ctx = drawingContext;
  ctx.save(); 
  ctx.beginPath();
  ctx.rect(0, 0, width, groundY); // vùng được vẽ: từ đỉnh màn hình xuống đường đất
  ctx.clip(); // từ giờ chỉ vẽ được bên trong vùng này
  drawFn(); // vẽ
  ctx.restore(); // bỏ vùng cắt, trả bút vẽ về như cũ
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generateCity();
  redraw();
}

// ======================= TẠO BỐ CỤC THÀNH PHỐ =======================
// Phần này chỉ TÍNH TOÁN (chưa vẽ gì). Chạy 1 lần lúc tải trang và lúc đổi cỡ cửa sổ.

function generateCity() {
  // danh sách 11 loại nhà theo thứ tự từ trái sang phải
  let types = createBuildingTypes();

  // Bchiều cao cho từng nhà (cùng thứ tự với types)
  let heights = createBuildingHeights(types);

  // chọn 2 chỗ có khe hở giữa các cụm nhà
  let gaps = createCityGaps(types.length);

  // kiểu cửa sổ cho từng nhà. 11 kiểu cho 11 nhà, xáo trộn ngẫu nhiên.
  let windowStyles = shuffleArray([
    "horizontalLines",
    "horizontalLines",
    "rectGrid",
    "rectGrid",
    "smallSquares",
    "smallSquares",
    "largeColumn",
    "randomWindows",
    "none",
    "none",
    "none",
  ]);

  // ghép tất cả thành danh sách nhà có vị trí x, bề ngang w...
  structures = createStructures(types, heights, windowStyles, gaps);

  // sort((a, b) => b.h - a.h): nếu b cao hơn a thì b đứng trước a.
  structures.sort((a, b) => b.h - a.h);

  let n = structures.length;
  let accents = shuffleArray(brightPalette);

  // 4 nhà thấp nhất nhận 4 màu nổi
  for (let i = 0; i < 4; i++) {
    // i = 0 (thấp nhất)
    structures[n - 1 - i].colors = accents[i];
  }

  // 2 nhà thấp nhất không có cửa sổ
  structures[n - 1].windowStyle = "none";
  structures[n - 2].windowStyle = "none";

  // AI HELPED: Hai dòng này bốc ngẫu nhiên hai số nguyên từ 0 đến 999.999 (random(1000000) cho ra một số thực, floor làm tròn xuống) rồi lưu vào structureSeed và backgroundSeed. Mỗi lần vẽ, randomSeed(...) dùng lại đúng số đó, nên random() luôn cho ra cùng một dãy kết quả. Nhờ vậy, khi cuộn trang thì thành phố và dãy nhà nền đứng yên, không nhảy lung tung, và hình phản chiếu khớp y hệt nhà thật. Seed chỉ được chọn một lần trong generateCity(), nên mỗi lần tải lại trang sẽ có seed mới và ra một thành phố khác. Dùng hai seed riêng để nhà nền và thành phố chính lấy hai dãy số ngẫu nhiên độc lập, không phụ thuộc vào nhau.
  structureSeed = floor(random(1000000));
  backgroundSeed = floor(random(1000000));
}

// Trả về mảng 11 loại nhà theo thứ tự từ trái sang phải
function createBuildingTypes() {
  // Xáo trộn nhà
  let types = shuffleArray([
    "double",
    "double",
    "double",
    "triple",
    "single",
    "single",
    "single",
    "pointed",
    "pointed",
  ]);

  // splice(vị_trí, số_phần_tử_xoá, phần_tử_chèn): chèn vào mảng tại vị trí đó.
  // Chèn nhà mái chéo vào vị trí 2 → đứng thứ 3 từ trái.
  types.splice(2, 0, "slanted");

  // Chèn nhà mái đặc biệt vào vị trí 10 - 2 = 8.
  types.splice(types.length - 2, 0, "specialRoof");

  return types;
}

// Trả về mảng chiều cao, cùng thứ tự với types (heights[i] là chiều cao của types[i])
function createBuildingHeights(types) {
  let levels = [];
  for (let i = 0; i < types.length; i++) {
    levels.push(height * (0.1 + i * 0.045));
  }

  // pop() lấy phần tử CUỐI mảng ra (và xoá nó khỏi mảng).
  // Mảng đang xếp thấp → cao, nên phần tử cuối là cao nhất.
  let tallest = levels.pop();
  let second = levels.pop();

  // xáo trộn 9 bậc còn lại để chia ngẫu nhiên cho 9 nhà thường
  let rest = shuffleArray(levels);

  let heights = [];
  for (let i = 0; i < types.length; i++) {
    if (types[i] == "slanted") {
      heights.push(tallest); // nhà cao nhất là nhà mái chéo
    } else if (types[i] == "specialRoof") {
      heights.push(second); // nhà thứ 2 là nhà mái đặc biệt
    } else {
      heights.push(rest.pop()); // nhà thường: lấy 1 bậc trong số còn lại
    }
  }
  return heights;
}

// Chọn 2 chỗ có khe hở. Trả về mảng 2 số, ví dụ [3, 7].
// Số i nghĩa là có khe giữa nhà thứ i và nhà thứ i+1.
// Chỉ chọn từ 0 đến count-2, vì nhà cuối (count-1) không có nhà nào phía sau.
function createCityGaps(count) {
  let gaps = [];

  // Lặp đến khi chọn được đủ 2 chỗ
  while (gaps.length < 2) {
    // random(count - 1) ra số thực từ 0 đến dưới count-1
    // → số nguyên từ 0 đến count-2
    let candidate = floor(random(count - 1));

    // Chỉ thêm nếu chưa có (tránh chọn trùng 2 lần cùng 1 chỗ)
    if (!gaps.includes(candidate)) {
      gaps.push(candidate);
    }
  }
  return gaps;
}

// Xếp các nhà từ trái sang phải, rồi co giãn cả dãy cho vừa màn hình
function createStructures(types, heights, windowStyles, gaps) {
  let result = [];

  for (let i = 0; i < types.length; i++) {
    let w = getBuildingWidth(types[i]);

    // Vị trí x (mép trái), tính dựa vào nhà đứng trước
    let x = getNextBuildingX(i, result, w, gaps);

    result.push({
      type: types[i], // loại nhà
      x: x, // mép trái
      w: w, // bề ngang
      h: heights[i], // chiều cao
      colors: random(buildingPalette), // bốc ngẫu nhiên 1 bộ màu thường
      windowStyle: windowStyles[i], // kiểu cửa sổ
      windowSide: floor(random(2)), // 0 hoặc 1: với cụm nhiều khối, cửa sổ nằm ở khối trái (0) hay phải (1)
      riseDelay: random(0.8), // ANIMATION: nhà này mọc trễ ngẫu nhiên 0 đến 0.8 giây 
    });
  }

  // ---- Co giãn cho cả dãy rộng đúng 90% màn hình và nằm giữa ----
  // Nhà đầu tiên bắt đầu ở x = 0, nhà cuối luôn nằm xa nhất bên phải,
  // nên mép phải của nhà cuối = bề ngang cả dãy.
  let last = result[result.length - 1];
  let cityW = last.x + last.w;
  let scale = (width * 0.9) / cityW;

  for (let b of result) {
    // Nhân vị trí với tỉ lệ, rồi dịch sang phải 5% màn hình để chừa lề trái
    b.x = b.x * scale + width * 0.05;
    // Nhân bề ngang với cùng tỉ lệ
    b.w = b.w * scale;
  }
  return result;
}

function getBuildingWidth(type) {
  let minRatio;
  let maxRatio;

  if (type == "double") {
    minRatio = 0.085;
    maxRatio = 0.14;
  } else if (type == "triple") {
    minRatio = 0.1;
    maxRatio = 0.15;
  } else if (type == "slanted") {
    minRatio = 0.12;
    maxRatio = 0.16;
  } else if (type == "specialRoof") {
    minRatio = 0.085;
    maxRatio = 0.14;
  } else {
    // nhà đơn
    minRatio = 0.055;
    maxRatio = 0.09;
  }

  return random(width * minRatio, width * maxRatio);
}

// Tính vị trí x (mép trái) cho nhà thứ index
function getNextBuildingX(index, result, buildingW, gaps) {
  // Nhà đầu tiên: đặt ở x = 0 (sau này sẽ được dịch vào giữa)
  if (index == 0) {
    return 0;
  }

  // Nhà đứng ngay trước
  let previous = result[index - 1];

  // Mép phải của nhà đứng trước
  let right = previous.x + previous.w;

  // Trường hợp 1: có khe giữa nhà trước và nhà này
  // → đặt nhà này cách mép phải một đoạn 2.5% đến 4.5% màn hình
  if (gaps.includes(index - 1)) {
    return right + random(width * 0.025, width * 0.045);
  }

  // Trường hợp 2: không có khe → cho 2 nhà chồng lên nhau một chút để liền mạch.
  // Phần chồng = 8% đến 20% bề ngang của nhà HẸP HƠN,
  // để nhà nhỏ không bị nhà to che mất.
  let narrower = min(buildingW, previous.w);
  return right - random(narrower * 0.08, narrower * 0.2);
}

// Độ dày của mặt bên
function getDepth(building) {
  return min(building.w * 0.14, width * 0.018);
}

// ======================= NỀN: TRỜI, ĐẤT, BIỂN =======================

function drawSky(groundY) {
  let gradient = createVerticalGradient(0, groundY, skyColor); // gradient từ y = 0 đến y = groundY
  fillCanvasRect(gradient, 0, 0, width, groundY); // tô hình chữ nhật: x = 0, y = 0, rộng = width, cao = groundY
}

function drawGroundBackground(groundY, opacity) {
  let startY = groundY + groundLineH;
  let gradient = createVerticalGradient(startY, height, groundBackgroundColor);
  fillCanvasRect(gradient, 0, startY, width, height - startY, opacity); // opacity: mờ dần khi nước dâng
}

function drawWater(waterY, stops) {
  // Nước còn ở đáy màn hình (chưa dâng) thì không cần vẽ
  if (waterY >= height) {
    return;
  }
  let gradient = createGradient(0, waterY, 0, height, stops);
  fillCanvasRect(gradient, 0, waterY, width, height - waterY);
}

function drawBackgroundBuildings(groundY, opacity) {
  randomSeed(backgroundSeed);

  let x = 0;

  // Bọc trong clipAboveGround: phần nhà còn nằm dưới đất sẽ không bị vẽ ra
  clipAboveGround(groundY, () => {
    // Lặp cho đến khi x vượt quá mép phải màn hình
    while (x < width) {
      let w = min(random(width * 0.05, width * 0.08), width - x);

      let h = random(height * 0.12, height * 0.54);

      // ANIMATION: nhà nền mọc trước nhà chính, mỗi nhà bắt đầu ở một thời điểm ngẫu nhiên
      let rise = riseAmount(random(0.3), 0.8);

      // Đáy nhà: lúc chưa mọc (rise = 0) nằm sâu dưới đất đúng bằng chiều cao nhà,
      // mọc xong (rise = 1) thì nằm đúng trên đường đất.
      let bottomY = groundY + (1 - rise) * h;

      // Đỉnh nhà = đáy trừ chiều cao (vì y tăng xuống dưới)
      let topY = bottomY - h;

      // Tô gradient từ đỉnh nhà xuống đáy nhà (gradient đi theo nhà khi nhà trồi lên)
      let gradient = createVerticalGradient(
        topY,
        bottomY,
        backgroundBuildingsColor,
      );
      fillCanvasRect(gradient, x, topY, w, h, opacity);

      // 30% khả năng có khe hở nhỏ
      let gap = 0;
      if (random(1) < 0.3) {
        gap = random(width * 0.005, width * 0.018);
      }

      // Dịch x sang phải để vẽ nhà tiếp theo
      x = x + w + gap;
    }
  });
}

function drawCenterBuilding(groundY, opacity) {
  let h = height * 0.8;
  let rise = riseAmount(0.15, 1.1);

  // Đáy tháp: lúc chưa mọc nằm sâu dưới đất bằng chiều cao tháp, mọc xong thì nằm trên đường đất
  let bottomY = groundY + (1 - rise) * h;

  let topY = bottomY - h;
  let cx = width / 2; // trục giữa màn hình

  let roofW = width * 0.008;
  let topW = width * 0.015;
  let midW = width * 0.032;
  let baseW = width * 0.055;

  let level0 = topY + h * 0.08;
  let level1 = topY + h * 0.15;
  let level2 = topY + h * 0.25;

  // Gradient từ đỉnh tháp xuống ĐÁY tháp (bottomY), để màu đi theo tháp khi trồi lên
  let gradient = createVerticalGradient(topY, bottomY, centerBuildingColor);

  // Bọc trong clipAboveGround: phần tháp còn dưới đất không bị vẽ ra
  clipAboveGround(groundY, () => {
    withAlpha(opacity, () => {
      // Mái tam giác: đỉnh ở giữa
      fillPolygon(
        [
          [cx, topY],
          [cx + roofW / 2, level0],
          [cx - roofW / 2, level0],
        ],
        gradient,
      );
      // 3 đoạn thân, mỗi đoạn là 1 hình chữ nhật căn giữa theo cx
      fillCanvasRect(gradient, cx - topW / 2, level0, topW, level1 - level0);
      fillCanvasRect(gradient, cx - midW / 2, level1, midW, level2 - level1);
      // Đoạn đế kéo xuống tới đáy tháp (bottomY), không phải groundY
      fillCanvasRect(gradient, cx - baseW / 2, level2, baseW, bottomY - level2);
    });
  });
}

// ======================= THÀNH PHỐ CHÍNH =======================

function drawMainCity(groundY) {
  randomSeed(structureSeed);

  // Bọc trong clipAboveGround: phần nhà còn nằm dưới đất không bị vẽ ra.
  // (Hàm này cũng được gọi để vẽ phản chiếu lộn ngược, nên bóng cũng "mọc" theo nhà.)
  clipAboveGround(groundY, () => {
    for (let building of structures) {
      let depth = getDepth(building);

      // ANIMATION: nhà chính mọc sau nhà nền, theo thứ tự NGẪU NHIÊN.
      // riseDelay đã được bốc sẵn trong createStructures (0 đến 0.8 giây)
      // → mỗi nhà bắt đầu mọc ở một thời điểm ngẫu nhiên từ giây 0.4 đến giây 1.2.
      let startTime = 0.4 + building.riseDelay;
      let rise = riseAmount(startTime, 0.9); // mỗi nhà mọc trong 0.9 giây

      // Đẩy đường đất của RIÊNG nhà này xuống dưới một đoạn.
      // × 1.2 (thay vì × 1) để giấu luôn cả mái nhỏ và ăng-ten nhô lên trên nóc nhà.
      // rise = 0 → nhà nằm hẳn dưới đất (bị clip che); rise = 1 → nhà đứng đúng trên đường đất.
      let baseY = groundY + (1 - rise) * building.h * 1.2;

      // Vẽ hình nhà với đường đất đã đẩy xuống. Hàm trả về danh sách "mặt tiền" (vùng sẽ đặt cửa sổ).
      // Cửa sổ tính theo mặt tiền nên cũng tự trồi lên theo nhà.
      let faces = drawBuildingShape(building, baseY, depth);

      drawWindowsOnFacades(faces, building.windowStyle);
    }
  });
}

function drawBuildingShape(b, groundY, depth) {
  if (b.type == "single") return drawSingle(b, groundY, depth);
  if (b.type == "pointed") return drawPointed(b, groundY, depth);
  if (b.type == "double") return drawDouble(b, groundY, depth);
  if (b.type == "triple") return drawTriple(b, groundY, depth);
  if (b.type == "slanted") return drawSlanted(b, groundY, depth);
  if (b.type == "specialRoof") return drawSpecialRoof(b, groundY, depth);
}

function drawSingle(b, groundY, depth) {
  let topY = groundY - b.h;

  drawGradientRect3D(b.x, topY, b.w, b.h, b.colors, depth);

  // Mặt tiền = cả mặt trước của nhà
  return [makeFacade(b.x, topY, b.w, b.h, 0)];
}

function drawSpecialRoof(b, groundY, depth) {
  let faces = drawSingle(b, groundY, depth);
  drawRoofCap(b, groundY - b.h);
  return faces;
}

function drawRoofCap(b, topY) {
  let cx = b.x + b.w / 2;
  let capW = b.w * 0.46;
  let capH = max(5, b.h * 0.035);
  let capX = cx - capW / 2;
  let capY = topY - capH;
  let peakY = capY - capH * 1.1;
  let antennaTopY = capY - capH * 2.6;

  // Màu mái = màu trên cùng của nhà, cũng tối dần khi chìm
  let capColor = sinkColor(b.colors[0], sunkenCityColor[0]);

  setFillColor(capColor);
  rect(capX, capY, capW, capH);
  triangle(capX, capY, capX + capW, capY, cx, peakY); // tam giác: góc trái, góc phải, đỉnh
  setStrokeColor(capColor); 
  line(cx, peakY, cx, antennaTopY); // ăng-ten: đường thẳng đứng
  noStroke();
}

function drawPointed(b, groundY, depth) {
  let roofY = groundY - b.h;
  let roofH = min(b.w * 0.35, b.h * 0.12);
  let bodyH = b.h - roofH;
  let bodyY = groundY - bodyH;

  drawGradientRect3D(b.x, bodyY, b.w, bodyH, b.colors, depth);
  drawPointedRoof(b, roofY, bodyY, depth);
  // Mặt tiền chỉ là phần thân (cửa sổ không nằm trên mái)
  return [makeFacade(b.x, bodyY, b.w, bodyH, 0)];
}

function drawPointedRoof(b, roofY, bodyY, depth) {
  let cx = b.x + b.w / 2;
  let right = b.x + b.w;
  let side = cityGradient(roofY, bodyY, darkenPalette(b.colors)); //phần 3D side màu tối hơn
  let front = cityGradient(roofY, bodyY, b.colors);

  // Mặt bên của mái: hình bình hành = cạnh phải của tam giác, kéo sang phải thêm depth
  fillPolygon(
    [
      [cx, roofY], // đỉnh mái
      [right, bodyY], // góc dưới bên phải của tam giác
      [right + depth, bodyY], // góc đó dịch sang phải depth
      [cx + depth, roofY], // đỉnh mái dịch sang phải depth
    ],
    side,
  );

  // Mặt trước của mái: tam giác
  fillPolygon(
    [
      [b.x, bodyY], // góc dưới bên trái
      [right, bodyY], // góc dưới bên phải
      [cx, roofY], // đỉnh
    ],
    front,
  );
}

function drawDouble(b, groundY, depth) {
  let partW = b.w * 0.58;
  let lowH = b.h * random(0.78, 0.9);
  let leftIsTall = random(1) < 0.5;

  let leftH;
  let rightH;
  if (leftIsTall) {
    leftH = b.h;
    rightH = lowH;
  } else {
    leftH = lowH;
    rightH = b.h;
  }

  let rightX = b.x + b.w - partW;

  let g = createClusterGradients(b, groundY);

  drawBox(b.x, groundY - leftH, partW, leftH, depth, g.front, g.side);
  drawBox(rightX, groundY - rightH, partW, rightH, depth, g.front, g.side); //trái -> phải

  // Chỉ 1 khối có cửa sổ, chọn theo windowSide
  if (b.windowSide == 0) {
    return [makeFacade(b.x, groundY - leftH, partW, leftH, 0)];
  } else {
    return [makeFacade(rightX, groundY - rightH, partW, rightH, 0)];
  }
}

function drawTriple(b, groundY, depth) {
  let partW = b.w * 0.46;
  let sideH = b.h * random(0.82, 0.9);

  // Vị trí x của khối giữa (căn giữa cụm) và khối phải (sát mép phải)
  let middleX = b.x + (b.w - partW) / 2;
  let rightX = b.x + b.w - partW;
  let g = createClusterGradients(b, groundY);

  drawBox(b.x, groundY - sideH, partW, sideH, depth, g.front, g.side);
  drawBox(middleX, groundY - b.h, partW, b.h, depth, g.front, g.side);
  drawBox(rightX, groundY - sideH, partW, sideH, depth, g.front, g.side); //trái -> giữa -> phải

  let faceX;
  if (b.windowSide == 0) {
    faceX = b.x;
  } else {
    faceX = rightX;
  }
  return [makeFacade(faceX, groundY - sideH, partW, sideH, 0)];
}

// Tạo gradient dùng chung cho mọi khối trong 1 cụm.
// Gradient trải theo chiều cao CẢ CỤM (không phải từng khối), -> nên ở cùng một độ cao, các khối có màu giống nhau → nhìn liền mạch.

function createClusterGradients(b, groundY) {
  let topY = groundY - b.h; // đỉnh khối cao nhất
  let front = cityGradient(topY, groundY, b.colors);
  let side = cityGradient(topY, groundY, darkenPalette(b.colors));
  return { front: front, side: side };
}

function drawSlanted(b, groundY, depth) {
  let topY = groundY - b.h;
  let drop = b.h * random(0.08, 0.14);
  let right = b.x + b.w;
  let rightTopY = topY + drop;
  let sideColors = darkenPalette(b.colors);
  let roof = cityGradient(topY, rightTopY, sideColors);
  let side = cityGradient(rightTopY, groundY, sideColors);
  let front = cityGradient(topY, groundY, b.colors);

  fillPolygon(
    [
      [b.x, topY],
      [right, rightTopY],
      [right + depth, rightTopY],
      [b.x + depth, topY],
    ],
    roof,
  );

  fillPolygon(sideFace(right, rightTopY, groundY, depth), side);

  fillPolygon(
    [
      [b.x, topY],
      [right, rightTopY],
      [right, groundY],
      [b.x, groundY],
    ],
    front,
  );

  // cửa sổ phải bắt đầu dưới phần mái nghiêng
  return [makeFacade(b.x, topY, b.w, b.h, drop)];
}

// Gói thông tin 1 mặt tiền (vùng sẽ đặt cửa sổ) thành 1 object.
//   x, y     = góc trên bên trái
//   w, h     = bề ngang, chiều cao
//   topInset = khoảng phía trên KHÔNG được vẽ cửa sổ (chỉ nhà mái chéo dùng, các nhà khác = 0)
function makeFacade(x, y, w, h, topInset) {
  return { x: x, y: y, w: w, h: h, topInset: topInset };
}

// ======================= KHỐI 3D VÀ MÀU CHÌM =======================

function drawGradientRect3D(x, y, w, h, colors, depth) {
  let front = cityGradient(y, y + h, colors);
  let side = cityGradient(y, y + h, darkenPalette(colors));
  drawBox(x, y, w, h, depth, front, side);
}

function drawBox(x, y, w, h, depth, front, side) {
  fillPolygon(sideFace(x + w, y, y + h, depth), side); // mặt bên bắt đầu từ mép phải (x + w)
  fillCanvasRect(front, x, y, w, h);
}

// 4 góc của mặt bên
function sideFace(x, topY, bottomY, depth) {
  return [
    [x, topY],
    [x + depth, topY],
    [x + depth, bottomY],
    [x, bottomY],
  ];
}

function cityGradient(topY, bottomY, colors) {
  let sunk = [];
  for (let i = 0; i < colors.length; i++) {
    sunk.push(sinkColor(colors[i], sunkenCityColor[i])); //màu city khi chìm xuống
  }
  return createVerticalGradient(topY, bottomY, sunk);
}

// lerpColor là lerp cho màu. toString("#rrggbb") đổi kết quả thành chuỗi mã màu.
function sinkColor(c, target) {
  return lerpColor(color(c), color(target), cityDarkness).toString("#rrggbb");
}

function darkenPalette(colors) {
  if (random(1) < 0.5) {
    // Cách 1: lấy ngẫu nhiên 1 bộ màu bất kỳ (thường + nổi), rồi đảo ngược thứ tự (đậm ↔ nhạt).
    // slice() tạo bản sao, để reverse() không làm đảo ngược luôn bộ màu gốc.
    let palettes = buildingPalette.concat(brightPalette); // nối 2 danh sách thành 1
    let picked = random(palettes); // bốc 1 bộ
    return picked.slice().reverse();
  }

  // Cách 2: pha từng màu gốc với 25% màu tím lavender → tối hơn một chút
  let tint = color("#7F8CE8");
  let result = [];
  for (let c of colors) {
    result.push(lerpColor(color(c), tint, 0.25).toString("#rrggbb"));
  }
  return result;
}

// ======================= CỬA SỔ =======================

function drawWindowsOnFacades(facades, style) {
  if (style == "none") {
    return;
  }

  setFillColor(sinkColor("#ffffff", sunkenWindowColor));

  for (let face of facades) {
    // Tính vùng được phép vẽ cửa sổ (đã trừ lề)
    let b = getWindowBounds(face);

    if (style == "horizontalLines") drawHorizontalWindows(b);
    if (style == "rectGrid") drawRectWindows(b);
    if (style == "smallSquares") drawSmallSquares(b);
    if (style == "largeColumn") drawLargeColumn(b);
    if (style == "randomWindows") drawRandomWindows(b);
  }
}

function getWindowBounds(face) {
  let marginX = face.w * 0.08;

  // Lề trên = lấy giá trị LỚN HƠN giữa topInset và 15% chiều cao.
  // Nhà mái chéo có topInset lớn → cửa sổ bắt đầu thấp hơn, không lòi ra mái.
  let topY = face.y + max(face.topInset, face.h * 0.15);

  let bottomY = face.y + face.h * 0.92;

  return {
    x: face.x,
    w: face.w,
    marginX: marginX,
    topY: topY,
    bottomY: bottomY,
    usableW: face.w - marginX * 2,
    usableH: bottomY - topY,
  };
}

// cửa sổ ngang mảnh, chạy hết bề ngang mặt nhà (không chừa lề)
function drawHorizontalWindows(b) {
  let rows = floor(random(7, 12));
  let spacing = b.usableH / rows;
  let lineH = max(2, b.usableH * 0.006);

  for (let row = 0; row < rows; row++) {
    let y = b.topY + row * spacing;
    rect(b.x, y, b.w, lineH);
  }
}

function drawRectWindows(b) {
  let columns = max(3, floor(b.w / 38));
  let rows = floor(random(5, 9));

  drawWindowGrid(b, columns, rows, 0.82, 0.28);
}

function drawSmallSquares(b) {
  let columns = max(3, floor(b.w / 20)); // cứ khoảng 20px là 1 cột, ít nhất 3 cột
  let rows = floor(random(6, 11));
  let cellW = b.usableW / columns;
  let cellH = b.usableH / rows;
  // Cạnh ô vuông = 48% của chiều NGẮN HƠN của ô (để ô vuông luôn lọt trong ô lưới)
  let side = min(cellW, cellH) * 0.48;

  drawWindowGrid(b, columns, rows, side / cellW, side / cellH);
}

function drawLargeColumn(b) {
  let rows = floor(random(3, 6));

  drawWindowGrid(b, 1, rows, 0.5, 0.55);
}

function drawWindowGrid(b, columns, rows, widthRatio, heightRatio) {
  let cellW = b.usableW / columns;
  let cellH = b.usableH / rows;
  let winW = cellW * widthRatio;
  let winH = cellH * heightRatio;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      let cellX = b.x + b.marginX + col * cellW;
      let cellY = b.topY + row * cellH;
      let x = cellX + (cellW - winW) / 2;
      let y = cellY + (cellH - winH) / 2;

      rect(x, y, winW, winH);
    }
  }
}

function drawRandomWindows(b) {
  let count = floor(random(5, 9));

  for (let i = 0; i < count; i++) {
    let w = random(b.usableW * 0.12, b.usableW * 0.32);
    let h = random(b.usableH * 0.025, b.usableH * 0.06);

    let x = random(b.x + b.marginX, b.x + b.w - b.marginX - w);

    let y = random(b.topY, b.bottomY - h);

    rect(x, y, w, h);
  }
}

// ======================= PHẢN CHIẾU & ĐƯỜNG ĐẤT =======================

function drawBuildingReflections(groundY, opacity) {
  let ctx = drawingContext;

  // Lưu trạng thái bút vẽ hiện tại (để lát nữa restore lại như cũ)
  ctx.save();

  // Tạo vùng cắt (clip): từ giờ chỉ vẽ được BÊN TRONG hình chữ nhật này,
  ctx.beginPath();
  ctx.rect(0, groundY + groundLineH, width, height - groundY - groundLineH);
  ctx.clip();

  // Lật đối xứng qua đường groundY:
  // translate dời gốc toạ độ xuống 2 × groundY, rồi scale(1, -1) lật ngược trục y.
  ctx.translate(0, groundY * 2);
  ctx.scale(1, -1);
  ctx.globalAlpha = 0.6 * opacity;

  // Vẽ lại thành phố y hệt (nhờ randomSeed bên trong) nhưng đang ở chế độ lật
  drawMainCity(groundY);

  // Trả bút vẽ về như cũ: bỏ vùng cắt, bỏ lật, bỏ độ mờ
  ctx.restore();
}

// Phủ lớp trắng lên phản chiếu: càng xuống dưới càng trắng → bóng nhạt dần
function drawReflectionFade(groundY, opacity) {
  let startY = groundY + groundLineH;
  let gradient = createVerticalGradient(startY, height, reflectionFadeColor);
  fillCanvasRect(gradient, 0, startY, width, height - startY, opacity);
}

function drawGroundline(groundY, opacity) {
  let gradient = createGradient(0, groundY, width, groundY, groundlineStops); //gradient ngang
  fillCanvasRect(gradient, 0, groundY, width, groundLineH, opacity);
}

// ======================= CUỘN TRANG =======================

// Chạy mỗi khi người dùng cuộn (và 1 lần lúc setup).
// Đổi vị trí cuộn thành:
//   - waterProgress: mực nước (0 → 1)
//   - data-story trên thẻ <body>: đoạn text nào đang hiện (-1 = chưa hiện, 0, 1, 2)
function updateWaterFromScroll() {
  let space = document.querySelector("#scroll-space");

  // Quãng cuộn tối đa = chiều cao vùng cuộn - chiều cao màn hình.
  // max(1, ...) để không bao giờ bằng 0 (tránh chia cho 0 ở dòng dưới).
  let maxScroll = max(1, space.offsetHeight - window.innerHeight);

  // constrain(giá_trị, 0, 1): kẹp giá trị trong khoảng 0 đến 1.
  let scrollProgress = constrain(window.scrollY / maxScroll, 0, 1);

  // ---- Mực nước ----
  // Nước dâng xong khi cuộn được 65% quãng. 35% còn lại để đổi text.
  let waterEnd = 0.45;
  waterProgress = constrain(scrollProgress / waterEnd, 0, 1);

  // ---- Đoạn text đang hiện ----
  // Text bắt đầu khi nước dâng được 80%
  let storyStart = waterEnd * 0.8;

  let storyStep;
  if (scrollProgress < storyStart) {
    // Chưa tới chỗ hiện text
    storyStep = -1;
  } else {
    // Đã qua storyStart: chia phần cuộn còn lại (55% → 100%) làm 3 đoạn bằng nhau.
    // storyProgress đi từ 0 (ở storyStart) đến 1 (cuối quãng cuộn)
    let storyProgress = (scrollProgress - storyStart) / (1 - storyStart);
    storyStep = min(2, floor(storyProgress * 3));
  }

  // Ghi vào <body data-story="..."> để CSS biết hiện đoạn text nào
  document.body.dataset.story = storyStep;

  // Tiêu đề ONE DAY: ở đầu trang thì hiện (1), vừa cuộn là ẩn (0)
  let title = document.querySelector("#one-day-title");
  if (title) {
    if (window.scrollY > 0) {
      title.style.opacity = 0;
    } else {
      title.style.opacity = 1;
    }
  }
  // Vẽ lại cảnh với mực nước mới
  redraw();
}

// ======================= HÀM TIỆN ÍCH =======================

// Tạo gradient (chuyển màu) theo đường thẳng từ điểm (x0, y0) đến điểm (x1, y1).
// stops = danh sách [vị_trí, màu], vị trí từ 0 (điểm đầu) đến 1 (điểm cuối).
//   x0 = x1 → gradient DỌC;  y0 = y1 → gradient NGANG.
function createGradient(x0, y0, x1, y1, stops) {
  let gradient = drawingContext.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i++) {
    let position = stops[i][0]; // vị trí (0 → 1)
    let c = stops[i][1]; // màu
    gradient.addColorStop(position, c);
  }
  return gradient;
}

// Gradient dọc với các màu chia đều. Chỉ cần đưa danh sách màu, tự tính vị trí:
function createVerticalGradient(topY, bottomY, colors) {
  let stops = [];
  for (let i = 0; i < colors.length; i++) {
    let position = i / (colors.length - 1);
    stops.push([position, colors[i]]);
  }
  return createGradient(0, topY, 0, bottomY, stops);
}

// Đặt màu tô cho các hàm vẽ của p5 (rect, triangle...).
function setFillColor(c) {
  fill(c);
  drawingContext.fillStyle = c;
}

// Chạy hàm drawFn với độ mờ opacity (0 = trong suốt, 1 = rõ hoàn toàn)
function withAlpha(opacity, drawFn) {
  let ctx = drawingContext;
  ctx.save();

  // Dùng *= (nhân) thay vì = (gán): nếu đang ở trong vùng đã mờ sẵn (ví dụ phản chiếu 60%) thì độ mờ nhân dồn lên, không bị ghi đè thành rõ nét.
  ctx.globalAlpha = ctx.globalAlpha * opacity;

  // Vẽ
  drawFn();

  // Trả độ mờ về như cũ → không ảnh hưởng các thứ vẽ sau
  ctx.restore();
}

function setStrokeColor(c) {
  stroke(c);
  drawingContext.strokeStyle = c;
}

// Tô hình chữ nhật bằng Canvas API (vì rect() của p5 không tô được gradient).
// opacity không truyền vào thì mặc định = 1 (không mờ).
function fillCanvasRect(fillStyle, x, y, w, h, opacity = 1) {
  withAlpha(opacity, () => {
    drawingContext.fillStyle = fillStyle; // màu hoặc gradient
    drawingContext.fillRect(x, y, w, h); // tô
  });
}

// Tô một đa giác (tam giác, hình bình hành...) từ danh sách các góc [[x, y], [x, y], ...]
function fillPolygon(points, fillStyle) {
  let ctx = drawingContext;

  // Bắt đầu một hình mới
  ctx.beginPath();

  // Đặt bút ở góc đầu tiên
  ctx.moveTo(points[0][0], points[0][1]);

  // Kẻ đường thẳng lần lượt tới các góc tiếp theo
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }

  // Nối góc cuối về góc đầu cho kín hình
  ctx.closePath();

  // Tô màu
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

// AI HELPED: shuffleArray xáo trộn ngẫu nhiên thứ tự các phần tử trong mảng theo thuật toán Fisher–Yates, giống như xáo một bộ bài. Đầu tiên, hàm dùng slice() tạo một bản sao để không làm thay đổi mảng gốc (ví dụ brightPalette). Sau đó vòng lặp đi từ phần tử cuối về đầu. Ở mỗi vị trí i, hàm bốc ngẫu nhiên một vị trí j từ 0 đến i (floor(random(i + 1))) rồi đổi chỗ hai phần tử, dùng biến temp để giữ tạm giá trị, tránh bị ghi đè mất. Sau mỗi bước, phần tử ở vị trí i coi như đã chốt, và phần cần xáo ngắn lại một phần tử, giống như mỗi lần bốc một lá trong mũ rồi đặt vào cuối hàng. Vì j được phép bằng chính i, mọi cách sắp xếp đều có xác suất như nhau. Ví dụ với 4 phần tử có 4 × 3 × 2 = 24 cách, đúng bằng tổng số cách xếp có thể có, nên kết quả xáo là công bằng.
function shuffleArray(array) {
  let result = array.slice();

  for (let i = result.length - 1; i > 0; i--) {
    // Chọn ngẫu nhiên j trong khoảng 0 đến i
    let j = floor(random(i + 1));

    // Đổi chỗ result[i] và result[j] (dùng biến tạm để không bị mất giá trị)
    let temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}