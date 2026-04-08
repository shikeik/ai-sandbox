#!/usr/bin/env python3
"""
将 collections 目录的精选图片转换为 14×14 数据集
"""

import os
import random
import base64
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow: pip install Pillow")
    exit(1)

# 配置
TARGET_SIZE = 14
TRAIN_RATIO = 0.8

def load_and_convert(img_path: str) -> bytes:
    """加载图片并转为 14x14 字节数组"""
    img = Image.open(img_path).convert('L')
    img = img.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.LANCZOS)
    pixels = list(img.getdata())
    return bytes(int(p) for p in pixels)

def main():
    collections_dir = Path("mnist-data/MNIST Dataset JPG format/collections")
    
    if not collections_dir.exists():
        print(f"错误: 目录不存在 {collections_dir}")
        return
    
    all_samples = []
    
    for digit in range(10):
        digit_dir = collections_dir / str(digit)
        if not digit_dir.exists():
            print(f"警告: 数字 {digit} 目录不存在")
            continue
        
        images = list(digit_dir.glob("*.jpg"))
        print(f"数字 {digit}: 找到 {len(images)} 张")
        
        for img_path in images:
            try:
                pixel_bytes = load_and_convert(str(img_path))
                all_samples.append((pixel_bytes, digit))
            except Exception as e:
                print(f"处理 {img_path} 失败: {e}")
    
    print(f"\n总共: {len(all_samples)} 张")
    
    # 打乱并分割
    random.shuffle(all_samples)
    train_size = int(len(all_samples) * TRAIN_RATIO)
    train_samples = all_samples[:train_size]
    test_samples = all_samples[train_size:]
    
    print(f"训练集: {len(train_samples)} 张")
    print(f"测试集: {len(test_samples)} 张")
    
    # 生成 TypeScript
    output_path = Path("src/mnist-lab/real-dataset.ts")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("// ========== MNIST 精选数据集 (14×14) ==========\n")
        f.write("// 从 collections 目录提取并降采样\n")
        f.write(f"// 训练集: {len(train_samples)} 张 | 测试集: {len(test_samples)} 张\n\n")
        
        f.write("export interface MNISTSample {\n")
        f.write("  input: number[]  // 196维 (14×14), 值 0-1\n")
        f.write("  label: number   // 0-9\n")
        f.write("}\n\n")
        
        f.write("export const MNIST_STATS = {\n")
        f.write(f"  trainSize: {len(train_samples)},\n")
        f.write(f"  testSize: {len(test_samples)},\n")
        f.write(f"  imageSize: 14,\n")
        f.write(f"  inputDim: 196,\n")
        f.write(f"  numClasses: 10\n")
        f.write("}\n\n")
        
        # 解析函数
        f.write("function parseBase64(base64: string): number[] {\n")
        f.write("  const binary = atob(base64)\n")
        f.write("  const result: number[] = new Array(196)\n")
        f.write("  for (let i = 0; i < 196; i++) {\n")
        f.write("    result[i] = binary.charCodeAt(i) / 255\n")
        f.write("  }\n")
        f.write("  return result\n")
        f.write("}\n\n")
        
        # 训练集
        f.write("const TRAIN_BASE64: [string, number][] = [\n")
        for pixel_bytes, label in train_samples:
            b64 = base64.b64encode(pixel_bytes).decode('ascii')
            f.write(f'  ["{b64}",{label}],\n')
        f.write("]\n\n")
        
        # 测试集
        f.write("const TEST_BASE64: [string, number][] = [\n")
        for pixel_bytes, label in test_samples:
            b64 = base64.b64encode(pixel_bytes).decode('ascii')
            f.write(f'  ["{b64}",{label}],\n')
        f.write("]\n\n")
        
        # 导出函数
        f.write("export function getTrainData(): MNISTSample[] {\n")
        f.write("  return TRAIN_BASE64.map(([b64, label]) => ({ input: parseBase64(b64), label }))\n")
        f.write("}\n\n")
        
        f.write("export function getTestData(): MNISTSample[] {\n")
        f.write("  return TEST_BASE64.map(([b64, label]) => ({ input: parseBase64(b64), label }))\n")
        f.write("}\n")
    
    print(f"\n✅ 已保存到: {output_path}")
    print(f"文件大小: {output_path.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    main()
