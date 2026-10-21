<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PartCategoryAssignment;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PartCategoryAssignment> */
class PartCategoryAssignmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PartCategoryAssignment::class);
    }
}
