#!/usr/bin/env python3
"""
MNIST JPG 转 TypeScript 数据集 - ESLint兼容版
使用 Uint8Array (0-255) 减少体积，无分号
"""

import os
import random
import base64
import struct
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("错误: 需要 Pillow 库")
    exit(1)

# 配置
SAMPLES_PER_DIGIT = 100  # 每个数字 100 张
TOTAL_SAMPLES = 1000     # 共 1000 张
IMG_SIZE = 28
TRAIN_RATIO = 0.8

def load_and_convert_image(img_path: str) -> bytes:
    """加载 JPG 并转换为 28x28 字节数组 (0-255)"""
    img = Image.open(img_path).convert('L')
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.Resampling.LANCZOS)
    pixels = list(img.getdata())
    # 转为字节 (0-255)
    return bytes(int(p) for p in pixels)

def main():
    base_dir = Path("MNIST Dataset JPG format/collections")
    
    if not base_dir.exists():
        print(f"错误: 目录不存在 {base_dir}")
        return
    
    all_samples = []
    
    for digit in range(10):
        digit_dir = base_dir / str(digit)
        if not digit_dir.exists():
            continue
        
        images = list(digit_dir.glob("*.jpg"))
        selected = random.sample(images, min(SAMPLES_PER_DIGIT, len(images)))
        
        for img_path in selected:
            try:
                pixel_bytes = load_and_convert_image(str(img_path))
                all_samples.append((pixel_bytes, digit))
            except Exception as e:
                print(f"处理 {img_path} 失败: {e}")
    
    print(f"总共加载 {len(all_samples)} 张图片")
    
    random.shuffle(all_samples)
    
    train_size = int(len(all_samples) * TRAIN_RATIO)
    train_samples = all_samples[:train_size]
    test_samples = all_samples[train_size:]
    
    print(f"训练集: {len(train_samples)} 张")
    print(f"测试集: {len(test_samples)} 张")
    
    # 生成 TypeScript 文件 - ESLint 兼容 (无分号)
    output_path = Path("../../src/mnist-lab/real-dataset.ts")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("// ========== MNIST 真实数据集 (28x28) ==========\n")
        f.write("// 从 MNIST testing 目录提取\n")
        f.write(f"// 训练集: {len(train_samples)} 张 | 测试集: {len(test_samples)} 张\n\n")
        
        f.write("export interface MNISTSample {\n")
        f.write("  input: number[]  // 784维 (28x28), 值 0-1\n")
        f.write("  label: number   // 0-9\n")
        f.write("}\n\n")
        
        f.write("export const MNIST_STATS = {\n")
        f.write(f"  trainSize: {len(train_samples)},\n")
        f.write(f"  testSize: {len(test_samples)},\n")
        f.write(f"  imageSize: 28,\n")
        f.write(f"  inputDim: 784,\n")
        f.write(f"  numClasses: 10\n")
        f.write("}\n\n")
        
        # 辅助函数：解析 base64 为归一化数组
        f.write("function parseBase64(base64: string): number[] {\n")
        f.write("  const binary = atob(base64)\n")
        f.write("  const result: number[] = new Array(784)\n")
        f.write("  for (let i = 0; i < 784; i++) {\n")
        f.write("    result[i] = binary.charCodeAt(i) / 255\n")
        f.write("  }\n")
        f.write("  return result\n")
        f.write("}\n\n")
        
        # 训练集 - 延迟解析
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
        
        # 导出懒加载数据集
        f.write("export function getTrainData(): MNISTSample[] {\n")
        f.write("  return TRAIN_BASE64.map(([b64, label]) => ({ input: parseBase64(b64), label }))\n")
        f.write("}\n\n")
        
        f.write("export function getTestData(): MNISTSample[] {\n")
        f.write("  return TEST_BASE64.map(([b64, label]) => ({ input: parseBase64(b64), label }))\n")
        f.write("}\n")
    
    print(f"\n✅ 数据集已保存到: {output_path}")
    file_size = output_path.stat().st_size / 1024
    print(f"文件大小: {file_size:.1f} KB")

if __name__ == "__main__":
    main()
