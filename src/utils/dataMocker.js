export function generateDemoData(frameCount = 300) {
  const data = [];
  for (let i = 0; i < frameCount; i++) {
    const row = [];
    const timeValue = i * 0.033; // ~30 fps
    row.push(timeValue); // Col 0: Time

    // Col 1-10: 10 Strain Sensors (Joint Angles in degrees)
    for (let j = 0; j < 10; j++) {
      row.push(45 * Math.sin(timeValue * 2 + j) + 45); // Value between 0 and 90 degrees
    }

    // Col 11-52: 14 3D Force Sensors (14 * 3 = 42 columns)
    for (let f = 0; f < 14; f++) {
      const active = Math.sin(timeValue * 3 - f) > 0.5;
      const mag = active ? Math.abs(Math.sin(timeValue * 5 + f)) * 10 : 0;
      row.push(0);          // X
      row.push(mag * 0.8);  // Y
      row.push(mag * 0.6);  // Z
    }

    // Col 53-60: 8 Triboelectric Sensors (Scalar strength)
    for (let t = 0; t < 8; t++) {
      const active = Math.sin(timeValue * 4 + t * 0.5) > 0.7;
      row.push(active ? Math.random() * 100 : 0);
    }
    data.push(row);
  }
  return data;
}
