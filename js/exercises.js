export const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full body'];

export const EXERCISES = [
  ['Bench Press', 'Chest'], ['Incline Bench Press', 'Chest'], ['Dumbbell Bench Press', 'Chest'],
  ['Incline Dumbbell Press', 'Chest'], ['Chest Fly', 'Chest'], ['Push-up', 'Chest'], ['Dip', 'Chest'],
  ['Deadlift', 'Back'], ['Pull-up', 'Back'], ['Chin-up', 'Back'], ['Barbell Row', 'Back'],
  ['Dumbbell Row', 'Back'], ['Lat Pulldown', 'Back'], ['Seated Cable Row', 'Back'], ['Face Pull', 'Back'],
  ['Back Squat', 'Legs'], ['Front Squat', 'Legs'], ['Romanian Deadlift', 'Legs'], ['Leg Press', 'Legs'],
  ['Bulgarian Split Squat', 'Legs'], ['Lunge', 'Legs'], ['Leg Extension', 'Legs'], ['Leg Curl', 'Legs'],
  ['Hip Thrust', 'Legs'], ['Calf Raise', 'Legs'],
  ['Overhead Press', 'Shoulders'], ['Dumbbell Shoulder Press', 'Shoulders'], ['Lateral Raise', 'Shoulders'],
  ['Rear Delt Fly', 'Shoulders'], ['Arnold Press', 'Shoulders'],
  ['Barbell Curl', 'Arms'], ['Dumbbell Curl', 'Arms'], ['Hammer Curl', 'Arms'], ['Triceps Pushdown', 'Arms'],
  ['Skull Crusher', 'Arms'], ['Overhead Triceps Extension', 'Arms'],
  ['Plank', 'Core'], ['Hanging Leg Raise', 'Core'], ['Cable Crunch', 'Core'], ['Ab Wheel Rollout', 'Core'],
  ['Kettlebell Swing', 'Full body'], ['Power Clean', 'Full body'], ['Thruster', 'Full body'], ['Burpee', 'Full body'],
].map(([name, muscle]) => ({ name, muscle }));
