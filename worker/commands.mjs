import catalog from "../bot/catalog.json" with { type: "json" };

const sizes = { Small: "nhỏ", Medium: "vừa", Big: "lớn" };
const foodNames = Object.assign({}, ...Object.values(catalog.foods));
const number = new Intl.NumberFormat("vi-VN");

export const commands = [
  { name: "capsieubeo", description: "Cho Cabi ăn một món ngẫu nhiên.", type: 1 },
  {
    name: "cabi",
    description: "Xem Cabi của bạn hoặc của người chơi khác.",
    type: 1,
    options: [{ name: "player", description: "Người chơi có Cabi mà bạn muốn xem", type: 6 }],
  },
  { name: "foods", description: "Xem những món Cabi của bạn đã thử.", type: 1 },
];

function kilograms(grams) {
  const weight = BigInt(grams);
  const fraction = (weight % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${number.format(weight / 1000n)}${fraction ? "," + fraction : ""} kg`;
}

export async function respondToCommand(interaction, db) {
  const user = interaction.member?.user ?? interaction.user;
  const { name, options, resolved } = interaction.data;

  if (name === "capsieubeo") {
    const gain = (Math.floor(Math.random() * 10) + 1) * 100;
    const size = gain <= 300 ? "Small" : gain <= 700 ? "Medium" : "Big";
    const ids = Object.keys(catalog.foods[size]);
    const foodId = ids[Math.floor(Math.random() * ids.length)];
    const result = await db.feed(user.id, interaction.id, foodId, gain);
    if (!result) return { content: "Bữa ăn này đã được ghi nhận." };

    const food = foodNames[foodId];
    const lines = [
      `🍽️ Cabi của bạn đã ăn **${food}** (cỡ ${sizes[size]}) và tăng **${kilograms(gain)}**.`,
      `Cabi hiện nặng **${kilograms(result.weight)}**.`,
    ];
    if (result.firstDiscovery) lines.push(`✨ Lần đầu Cabi thử **${food}**!`);
    for (const milestone of catalog.milestones) {
      if (result.previousWeight < milestone && milestone <= result.weight) {
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
      ? "Dùng `/capsieubeo` để gặp Cabi của bạn."
      : `<@${ownerId}> chưa cho Cabi ăn lần nào.` };
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
  const displayName = member?.nick ?? owner?.global_name ?? owner?.username ?? ownerId;
  return { embeds: [{ title: `Cabi của ${displayName}`, description: lines.join("\n") }] };
}
