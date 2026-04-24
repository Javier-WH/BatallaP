import React, { useState, useCallback } from 'react';
import { Slider, Input, InputNumber, Button, Typography, Popconfirm, message, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface LetterGrade {
  letter: string;
  max: number;
}

interface LetterGradeSliderProps {
  value?: LetterGrade[];
  onChange?: (value: LetterGrade[]) => void;
  maxGrade?: number;
}

const LetterGradeSlider: React.FC<LetterGradeSliderProps> = ({ 
  value = [], 
  onChange, 
  maxGrade = 20 
}) => {
  const [grades, setGrades] = useState<LetterGrade[]>(value.length > 0 ? value : [
    { letter: 'A', max: 20 },
    { letter: 'B', max: 15 },
    { letter: 'C', max: 10 },
    { letter: 'D', max: 5 },
    { letter: 'E', max: 0 }
  ]);

  const updateGrades = useCallback((newGrades: LetterGrade[]) => {
    setGrades(newGrades);
    onChange?.(newGrades);
  }, [onChange]);

  const handleSliderChange = (values: number[]) => {
    // Slider returns values in ascending order, need to map them to grades sorted by max
    const sortedGrades = [...grades].sort((a, b) => a.max - b.max);
    
    // Prevent moving the first handle (min) and last handle (max)
    // They should always be 0 and maxGrade respectively
    if (values[0] !== 0 || values[values.length - 1] !== maxGrade) {
      // Reset to original values if extremes were moved
      return;
    }
    
    const newGrades = sortedGrades.map((grade, index) => ({
      ...grade,
      max: values[index] !== undefined ? values[index] : grade.max
    }));
    updateGrades(newGrades);
  };

  const handleLetterChange = (index: number, newLetter: string) => {
    const newGrades = [...grades];
    newGrades[index].letter = newLetter;
    updateGrades(newGrades);
  };

  const handleMaxChange = (index: number, newMax: number) => {
    const sortedGrades = [...grades].sort((a, b) => a.max - b.max);
    const currentIndex = sortedGrades.findIndex(g => grades.indexOf(g) === index);
    
    // Prevent moving the first (min) and last (max) handles
    if (currentIndex === 0 && newMax !== 0) {
      message.warning('El valor mínimo debe ser 0');
      return;
    }
    if (currentIndex === sortedGrades.length - 1 && newMax !== maxGrade) {
      message.warning(`El valor máximo debe ser ${maxGrade}`);
      return;
    }
    
    // Validate range
    if (newMax < 0 || newMax > maxGrade) {
      message.warning(`El valor debe estar entre 0 y ${maxGrade}`);
      return;
    }
    
    const newGrades = [...grades];
    newGrades[index].max = newMax;
    updateGrades(newGrades);
  };

  const handleAddLetter = () => {
    if (grades.length >= 10) {
      message.warning('Máximo 10 letras permitidas');
      return;
    }
    
    // Always add the new letter at the end (lowest position with value 0)
    // Find the current lowest grade
    const sortedGrades = [...grades].sort((a, b) => a.max - b.max);
    const lowestGrade = sortedGrades[0];
    const nextGrade = sortedGrades[1];
    
    // Calculate a new position for the lowest grade
    // Ensure it's at least 1 to avoid overlap with the new letter at 0
    let newLowestValue: number;
    if (nextGrade) {
      newLowestValue = Math.max(1, Math.floor(nextGrade.max / 2));
    } else {
      // If no next grade, use a reasonable fraction of maxGrade
      newLowestValue = Math.max(1, Math.ceil(maxGrade / (grades.length + 1)));
    }
    
    // Update the current lowest grade to the new position
    const newGrades = grades.map(g => {
      if (g.max === lowestGrade.max) {
        return { ...g, max: newLowestValue };
      }
      return g;
    });
    
    // Add the new letter at position 0
    const newLetter = String.fromCharCode(65 + newGrades.length); // A, B, C, ...
    newGrades.push({ letter: newLetter, max: 0 });
    
    updateGrades(newGrades);
  };

  const handleRemoveLetter = (index: number) => {
    if (grades.length <= 2) {
      message.warning('Mínimo 2 letras requeridas');
      return;
    }
    
    // Only allow removing the last letter (lowest max value)
    const sortedGrades = [...grades].sort((a, b) => b.max - a.max);
    const gradeToRemove = grades[index];
    const lowestGrade = sortedGrades[sortedGrades.length - 1];
    
    if (gradeToRemove.max !== lowestGrade.max) {
      message.warning('Solo se puede eliminar la última letra (la más baja)');
      return;
    }
    
    // Remove the lowest grade and set the next lowest to 0
    const newGrades = grades.filter((_, i) => i !== index);
    const newSortedGrades = [...newGrades].sort((a, b) => a.max - b.max);
    newSortedGrades[0].max = 0;
    
    updateGrades(newGrades);
  };

  // Get slider marks based on grades
  const getSliderMarks = () => {
    const marks: Record<number, string> = {};
    grades.forEach((grade) => {
      marks[grade.max] = grade.letter;
    });
    return marks;
  };

  // Get slider values (sorted ascending for Slider component)
  const getSliderValues = () => {
    return grades.map(g => g.max).sort((a, b) => a - b);
  };

  // Calculate range display for each grade
  const getRangeDisplay = (index: number): string => {
    const sortedGrades = [...grades].sort((a, b) => b.max - a.max);
    const current = sortedGrades[index];
    const next = sortedGrades[index + 1];
    
    if (next) {
      return `${next.max + 1} - ${current.max}`;
    } else {
      return `0 - ${current.max}`;
    }
  };

  const sortedGrades = [...grades].sort((a, b) => b.max - a.max);
  const lowestGrade = sortedGrades[sortedGrades.length - 1];

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text strong style={{ fontSize: 14 }}>Calificación con Letras</Text>
        <Tooltip title="Configure qué nota numérica equivale a cada letra. Si una nota está en el límite, se asigna a esa letra.">
          <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
        </Tooltip>
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 24, padding: '0 12px' }}>
        <Slider
          range
          min={0}
          max={maxGrade}
          value={getSliderValues()}
          onChange={handleSliderChange}
          marks={getSliderMarks()}
          step={1}
          tooltip={{ formatter: (value) => `${value} pts` }}
        />
      </div>

      {/* Grade List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedGrades.map((grade, index) => {
          const originalIndex = grades.indexOf(grade);
          return (
            <div
              key={originalIndex}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: index % 2 === 0 ? '#fafafa' : '#fff',
                borderRadius: 8,
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ width: 60 }}>
                <Input
                  value={grade.letter}
                  onChange={(e) => handleLetterChange(originalIndex, e.target.value.toUpperCase())}
                  maxLength={2}
                  style={{ 
                    textAlign: 'center', 
                    fontWeight: 700,
                    height: 36,
                    borderRadius: 8
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>
                  Rango: <Text strong>{getRangeDisplay(index)}</Text> puntos
                </Text>
              </div>

              <div style={{ width: 80, textAlign: 'right' }}>
                <InputNumber
                  value={grade.max}
                  onChange={(value) => handleMaxChange(originalIndex, value || 0)}
                  min={0}
                  max={maxGrade}
                  size="small"
                  style={{ width: 70, fontWeight: 700 }}
                  disabled={grade.max === 0 || grade.max === maxGrade}
                />
                <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 2 }}>pts</Text>
              </div>

              <Popconfirm
                title="Eliminar letra"
                description="¿Está seguro de eliminar esta letra?"
                onConfirm={() => handleRemoveLetter(originalIndex)}
                okText="Eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
                disabled={grade.max !== lowestGrade.max}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  disabled={grades.length <= 2 || grade.max !== lowestGrade.max}
                  style={{ borderRadius: 6 }}
                />
              </Popconfirm>
            </div>
          );
        })}
      </div>

      {/* Add Button */}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddLetter}
        block
        style={{ 
          marginTop: 16, 
          borderRadius: 8,
          height: 40,
          fontWeight: 600,
          borderStyle: 'dashed'
        }}
        disabled={grades.length >= 10}
      >
        Agregar Letra
      </Button>
    </div>
  );
};

export default LetterGradeSlider;
