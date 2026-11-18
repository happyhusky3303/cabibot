import catalog from "../bot/catalog.json" with { type: "json" };
import gymExcuses from "./gym-excuses.json" with { type: "json" };

const sizes = { Small: "nhỏ", Medium: "vừa", Big: "lớn" };
const foodNames = Object.assign({}, ...Object.values(catalog.foods));
const number = new Intl.NumberFormat("vi-VN");
const profileFields = [
  { id: "name", label: "Bạn muốn Cabi gọi bạn thế nào?", option: "Tên Cabi dùng để gọi bạn", limit: 64 },
  { id: "cabiname", label: "Bạn muốn đặt tên Cabi là gì?", option: "Tên riêng của Cabi. Nhập - để về tên mặc định", limit: 64 },
  { id: "desc", label: "Tiểu sử Cabi của bạn:", option: "Tiểu sử của Cabi. Nhập - để xóa", limit: 500 },
];

export const initModalId = "cabi:init";
export const initModal = {
  custom_id: initModalId,
  title: "Khởi tạo Cabi",
  components: profileFields.map(({ id, label, limit }) => ({
    type: 18,
    label,
    ...(id === "cabiname" ? { description: "Để trống để dùng tên Cabi của [Tên]." } : {}),
    component: {
      type: 4,
      custom_id: id,
      style: id === "desc" ? 2 : 1,
      required: id === "name",
      max_length: limit,
    },
  })),
};

export const commands = [
  { name: "init", description: "Khởi tạo Cabi của bạn.", type: 1 },
  {
    name: "editinfo",
    description: "Chỉnh sửa tên và tiểu sử trong hồ sơ Cabi.",
    type: 1,
    options: profileFields.map(({ id, option, limit }) => ({
      name: id, description: option, type: 3, max_length: limit,
    })),
  },
  { name: "capsieubeo", description: "Cho Cabi ăn một món ngẫu nhiên.", type: 1 },
  {
    name: "cabi",
    description: "Xem Cabi của bạn hoặc của người chơi khác.",
    type: 1,
    options: [{ name: "player", description: "Người chơi có Cabi mà bạn muốn xem", type: 6 }],
  },
  { name: "foods", description: "Xem những món Cabi của bạn đã thử.", type: 1 },
  { name: "gym", description: "Rủ Cabi đi tập gym. Chúc bạn may mắn!", type: 1 },
];

const needsInit = { content: "Dùng `/init` để khởi tạo Cabi của bạn." };

function cabiTitle(ownerName, cabiName) {
  return cabiName ? `Cabi ${cabiName}` : `Cabi của ${ownerName}`;
}

export async function submitInit(interaction, db) {
  const user = interaction.member?.user ?? interaction.user;
  const fields = new Map(interaction.data.components.map(({ component }) =>
    [component?.custom_id, component?.value?.trim()],
  ));
  const info = Object.fromEntries(profileFields.map(({ id }) => [id, fields.get(id) || null]));
  if (!info.name || profileFields.some(({ id, limit }) => (info[id]?.length ?? 0) > limit)) {
    return { content: "Bạn cần điền tên để Cabi gọi bạn. Hãy mở lại `/init` và kiểm tra độ dài các mục." };
  }
  if (!await db.initialize(user.id, info)) {
    return { content: "Bạn đã khởi tạo Cabi rồi. Dùng `/editinfo` để chỉnh sửa hồ sơ." };
  }
  return { embeds: [{
    title: cabiTitle(info.name, info.cabiname),
    description: "Cabi đã sẵn sàng! Dùng `/capsieubeo` để cho Cabi ăn.",
  }] };
}

function kilograms(grams) {
  const weight = BigInt(grams);
  const fraction = (weight % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${number.format(weight / 1000n)}${fraction ? "," + fraction : ""} kg`;
}

export async function respondToCommand(interaction, db) {
  const user = interaction.member?.user ?? interaction.user;
  const { name, options, resolved } = interaction.data;

  if (name === "gym") {
    const goesToGym = Math.random() < 0.005;
    const attempt = goesToGym
      ? { excuse: null, loss: (Math.floor(Math.random() * 5) + 1) * 100 }
      : { excuse: gymExcuses[Math.floor(Math.random() * gymExcuses.length)], loss: 0 };
    const result = await db.gym(user.id, interaction.id, attempt);
    if (!result || result.needsInit) return needsInit;
    if (result.excuse) return { content: `🛋️ **Cabi:** “${result.excuse}”` };

    const outcome = result.loss_grams
      ? `Cabi giảm **${kilograms(result.loss_grams)}** và hiện nặng **${kilograms(result.weight_grams)}**.`
      : `Cabi đã chạm mức cân thấp nhất **${kilograms(result.weight_grams)}**.`;
    return { embeds: [{
      color: 0xF5B942,
      title: "🚨 TIN CHẤN ĐỘNG: CABI THẬT SỰ ĐÃ ĐI TẬP GYM!",
      description: [
        "Ghế sofa bàng hoàng. Huấn luyện viên đánh rơi bình nước. Cabi bước qua cửa phòng tập và **tập thật**.",
        outcome,
      ].join("\n\n"),
      footer: { text: "Sự kiện hiếm · 0,5% (1 trên 200)" },
    }] };
  }

  if (name === "editinfo") {
    const changes = {};
    for (const { id, limit } of profileFields) {
      const option = options?.find((item) => item.name === id);
      if (!option) continue;
      const value = option.value.trim();
      if (value.length > limit || (id === "name" && !value)) {
        return { content: "Tên để Cabi gọi bạn không được để trống. Hãy kiểm tra độ dài các mục." };
      }
      changes[id] = id !== "name" && (!value || value === "-") ? null : value;
    }
    if (!Object.keys(changes).length) {
      return { content: "Chọn ít nhất một mục: `name`, `cabiname` hoặc `desc`." };
    }
    const updated = await db.editInfo(user.id, changes);
    if (!updated) return needsInit;
    return { embeds: [{
      title: cabiTitle(updated.owner_name, updated.cabi_name),
      description: "Đã cập nhật hồ sơ Cabi.",
    }] };
  }

  if (name === "capsieubeo") {
    const gain = (Math.floor(Math.random() * 10) + 1) * 100;
    const size = gain <= 300 ? "Small" : gain <= 700 ? "Medium" : "Big";
    const ids = Object.keys(catalog.foods[size]);
    const foodId = ids[Math.floor(Math.random() * ids.length)];
    const result = await db.feed(user.id, interaction.id, foodId, gain);
    if (!result) return { content: "Bữa ăn này đã được ghi nhận." };
    if (result.needsInit) return needsInit;

    const food = foodNames[foodId];
    const lines = [
      `🍽️ Cabi của bạn đã ăn **${food}** (cỡ ${sizes[size]}) và tăng **${kilograms(gain)}**.`,
      `Cabi hiện nặng **${kilograms(result.weight)}**.`,
    ];
    if (result.firstDiscovery) lines.push(`✨ Lần đầu Cabi thử **${food}**!`);
    for (const milestone of catalog.milestones) {
      if (result.previousHigh < milestone && milestone <= result.weight) {
        lines.push(`🎉 Nhờ **${food}**, Cabi đã cán mốc **${kilograms(milestone)}**!`);
      }
    }
    return { content: lines.join("\n") };
  }

  if (name === "foods") {
    const rows = await db.profile(user.id);
    const discovered = new Set(rows.map((row) => row.food_id));
    const fields = Object.entries(catalog.foods).map(([size, group]) => {
      const entries = Object.entries(group);
      const count = entries.filter(([id]) => discovered.has(id)).length;
      return {
        name: `Cỡ ${sizes[size]} · ${count}/${entries.length}`,
        value: entries.map(([id, food]) => discovered.has(id) ? food : "???").join("\n"),
        inline: true,
      };
    });
    return { embeds: [{ title: "Bộ sưu tập món ăn của Cabi", fields }] };
  }

  const ownerId = options?.find((option) => option.name === "player")?.value ?? user.id;
  const owner = resolved?.users?.[ownerId] ?? (ownerId === user.id ? user : null);
  const member = resolved?.members?.[ownerId] ?? (ownerId === user.id ? interaction.member : null);
  const rows = await db.profile(ownerId);
  if (!rows.length) {
    return { content: ownerId === user.id
      ? needsInit.content
      : `<@${ownerId}> chưa khởi tạo Cabi.` };
  }

  const foods = rows.filter((row) => row.food_id !== null);
  const meals = foods.reduce((total, row) => total + BigInt(row.meals), 0n);
  const lines = [
    `**Cân nặng** · ${kilograms(rows[0].weight_grams)}`,
    `**Số bữa đã ăn** · ${meals}`,
    `**Số món đã thử** · ${foods.length}`,
  ];
  if (foods.length) {
    const most = foods.reduce((best, row) => BigInt(row.meals) > BigInt(best.meals) ? row : best);
    const biggest = foods.reduce((best, row) => row.biggest_gain > best.biggest_gain ? row : best);
    lines.push(
      `**Món ăn nhiều nhất** · ${foodNames[most.food_id] ?? most.food_id} × ${most.meals}`,
      `**Món làm Cabi tăng cân nhiều nhất** · ${foodNames[biggest.food_id] ?? biggest.food_id} (+${kilograms(biggest.biggest_gain)})`,
    );
  }
  const profile = rows[0];
  const displayName = profile.owner_name ?? member?.nick ?? owner?.global_name ?? owner?.username ?? ownerId;
  const fields = [];
  if (profile.owner_name) fields.push({ name: "Cabi gọi bạn là", value: profile.owner_name });
  if (profile.description) fields.push({ name: "Tiểu sử", value: profile.description });
  return { embeds: [{
    title: cabiTitle(displayName, profile.cabi_name),
    description: lines.join("\n"),
    fields,
  }] };
}
