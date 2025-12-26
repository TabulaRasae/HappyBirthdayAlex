import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/lib/db";

export class Score extends Model {
  declare id: number;
  declare name: string;
  declare candles: number;
  declare timeMs: number;
  declare email: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Score.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    candles: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    timeMs: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    email: {
      type: DataTypes.STRING(254),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "scores",
  },
);
