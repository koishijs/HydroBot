export interface Item {
    id: string,
    weight: number,
    name: string,
    description: string,
}
export interface ItemMeta extends Record<string, never> { }
export const Items: Record<string, Item> = {
    fallback: {
        id: 'fallback',
        weight: 0,
        name: '未知物品',
        description: '未知物品',
    },
};
export function registerItem(id: string, weight: number, name: string, description: string) {
    Items[id] = {
        id, weight, name, description,
    };
}
