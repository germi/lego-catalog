<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SetSubset;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SetSubset> */
class SetSubsetRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SetSubset::class);
    }
}
